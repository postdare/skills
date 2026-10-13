#!/usr/bin/env python3
"""Benchmark fixed order or OAuth2 scenarios in fresh, sequential OMP sessions.

Requires the OMP CLI and the normal diagram rendering dependencies. Logs live
outside the diagram outputs. Passing reports still require source and visual review.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

SKILL = Path(__file__).resolve().parents[1]
MODEL = 'opencode-go/deepseek-flash'
PROMPTS = {
    'order': (
        f'阅读 {SKILL / "SKILL.md"} 并严格按其中的流程执行：'
        '画一张电商下单流程图（开始 → 提交订单 → 校验库存 → 创建订单 → 发起支付 → '
        '判断支付结果：成功则发货结束，失败则关闭订单），桌面展示场景，'
        '输出目录就用当前目录下的 out/。'
        '完成后汇报：输出文件列表、几何/语义检查结果、各阶段大致耗时。'
    ),
    'oauth2': (
        f'阅读 {SKILL / "SKILL.md"}，按技能生成一张 OAuth2 时序图，展示 OAuth2 授权码模式加 PKCE（S256）的成功路径。'
        '默认场景：公共客户端，不使用 client_secret；四个参与者为用户/浏览器、客户端应用、授权服务器、资源服务器。'
        '表达以下真实交互：客户端生成 state、code_verifier、S256 code_challenge；浏览器发起授权请求，'
        '用户在授权服务器登录并同意；授权服务器经浏览器重定向把 code 和 state 送回客户端；'
        '客户端校验 state，使用 code 与 code_verifier 请求 token；授权服务器验证 PKCE 后返回 access_token；'
        '客户端用 Authorization: Bearer access_token 请求资源服务器，资源服务器返回受保护资源。'
        '必须能区分浏览器重定向、token 交换和资源访问；只画成功路径，不扩展 OIDC、refresh token 或异常分支。'
        '来源约定为 RFC 6749 的授权码流程与 RFC 7636 的 PKCE；用明确编号和简洁标签保留这些语义。'
        '单帧、桌面展示，输出到当前目录的 out/，图稿 id 使用 oauth2-pkce。'
        '使用技能的时序风格与已有工具链，不改技能和脚本；完成后看实际 PNG、核对检查结果并简短汇报。'
    ),
}


def check_output(output):
    report = json.loads((output / 'report.json').read_text(encoding='utf-8'))
    viewports = report.get('viewports', [])
    checks = bool(report.get('passed') and viewports and all(
        view['frames'] == 1 and view['drawn'] == 1 and not view['errors']
        and not view['scriptErrors'] and all(
            item['geometry'] is not None and item['semantic'] is not None
            and not item['geometry']['errors'] and not item['semantic']['errors']
            for item in view['items']) for view in viewports))
    paths = [*output.glob('*.json'), *output.parent.glob('*.json')]
    documents = [json.loads(path.read_text(encoding='utf-8'))
                 for path in paths if path.name != 'report.json']
    keys = {item['key'] for view in viewports for item in view['items']}
    documents = [doc for doc in documents if isinstance(doc, dict) and
                 isinstance(doc.get('frames'), list) and
                 {frame['id'] for frame in doc['frames']} == keys]
    if len(documents) != 1 or len(documents[0]['frames']) != 1:
        return False
    frame = documents[0]['frames'][0]
    key = frame['id']
    # Source fidelity and visual quality require review, not exact-label matching.
    return checks and all(
        (output / name).is_file() for name in ('preview.html', f'{key}.svg', f'{key}-1200.png'))


def measure(directory, model, scenario='order'):
    prompt = PROMPTS[scenario]
    directory.mkdir()
    command = ['omp', '-p', '--model', model, '--mode', 'json',
               '--session-dir', str(directory / 'sessions'), '--cwd', str(directory), prompt]
    started_utc = datetime.now(timezone.utc).isoformat()
    skill_hash = hashlib.sha256((SKILL / 'SKILL.md').read_bytes()).hexdigest()
    toolchain_hash = hashlib.sha256()
    for relative in ('scripts/build.py', 'scripts/render.py', 'scripts/shoot.mjs',
                     'scripts/sequence.py', 'assets/diagram.js', 'assets/diagram.css',
                     'assets/check.js'):
        toolchain_hash.update(relative.encode('utf-8') + b'\0')
        toolchain_hash.update((SKILL / relative).read_bytes())
    prompt_hash = hashlib.sha256(prompt.encode('utf-8')).hexdigest()
    start = time.perf_counter()
    first_event = None
    observed_models = set()
    with (directory / 'events.jsonl').open('w', encoding='utf-8') as events, \
            (directory / 'stderr.log').open('w', encoding='utf-8') as stderr:
        process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                   stderr=stderr, text=True, bufsize=1)
        for line in process.stdout:
            elapsed = time.perf_counter() - start
            if first_event is None:
                first_event = elapsed
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                event = {'type': 'stdout', 'text': line.rstrip('\n')}
            events.write(json.dumps({'elapsed_s': round(elapsed, 4), 'event': event},
                                    ensure_ascii=False) + '\n')
            if event.get('type') == 'message_end':
                message = event.get('message', {})
                if message.get('role') == 'assistant' and message.get('model'):
                    observed_models.add(message['provider'] + '/' + message['model'])
        exit_code = process.wait()
    elapsed = time.perf_counter() - start
    output = directory / 'out'
    try:
        output_passed = check_output(output)
    except (OSError, ValueError, TypeError, KeyError):
        output_passed = False
    return {'scenario': scenario, 'started_utc': started_utc, 'elapsed_s': elapsed,
            'first_event_s': round(first_event, 3) if first_event is not None else None,
            'requested_model': model, 'observed_models': sorted(observed_models),
            'exit_code': exit_code, 'output_passed': output_passed,
            'skill_sha256': skill_hash,
            'toolchain_sha256': toolchain_hash.hexdigest(), 'prompt_sha256': prompt_hash,
            'output_files': sorted(path.name for path in output.iterdir()) if output.exists() else []}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True, help='fresh benchmark directory')
    parser.add_argument('--model', default=MODEL, help='exact provider/model identifier')
    parser.add_argument('--scenario', choices=tuple(PROMPTS), default='order',
                        help='fixed authoring scenario (default order)')
    parser.add_argument('--runs', type=int, default=3, help='sequential fresh sessions (default 3)')
    parser.add_argument('--ceiling', type=float, default=300, help='wall-clock ceiling in seconds')
    args = parser.parse_args()
    if args.runs < 1 or args.ceiling <= 0:
        parser.error('runs and ceiling must be positive')
    if args.out.exists():
        parser.error('benchmark directory already exists; use a fresh directory')
    root = args.out.resolve()
    root.mkdir(parents=True)
    summaries = []
    for number in range(1, args.runs + 1):
        summary = {'run': number, **measure(root / f'run-{number}', args.model, args.scenario)}
        summary['passed'] = (summary['exit_code'] == 0 and summary['output_passed']
                             and summary['observed_models'] == [args.model]
                             and summary['elapsed_s'] <= args.ceiling)
        summaries.append(summary)
        (root / 'summary.json').write_text(json.dumps(summaries, ensure_ascii=False, indent=2) + '\n',
                                          encoding='utf-8')
        print(json.dumps(summary, ensure_ascii=False), flush=True)
        if not summary['passed']:
            print('Ratchet failed; inspect events.jsonl and output before changing the workflow.',
                  file=sys.stderr)
            return 1
    print('Timing and output gate passed; review source fidelity and each final PNG independently.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
