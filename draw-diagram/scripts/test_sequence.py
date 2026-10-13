"""Consumer-visible sequence layout regressions; run with unittest discovery."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

if __package__:
    from .sequence import layout_sequence
else:
    from sequence import layout_sequence

SKILL = Path(__file__).resolve().parents[1]


def boundary_content():
    return {
        'nodes': [
            {'id': 'client', 'label': '客户端\n公共应用', 'value': 0},
            {'id': 'auth', 'label': '授权服务器', 'value': '/authorize\n/token'},
            {'id': 'api', 'label': '资源服务器'},
        ],
        'edges': [
            {'from': 'client', 'to': 'client',
             'label': '生成随机参数：code_challenge = BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))'},
            {'from': 'client', 'to': 'auth',
             'label': 'POST /token：grant_type=authorization_code；code 与 code_verifier'},
            {'from': 'auth', 'to': 'client', 'label': '返回 access_token', 'kind': 'reply'},
            {'from': 'client', 'to': 'api', 'label': 'Authorization: Bearer access_token'},
            {'from': 'api', 'to': 'api',
             'label': '校验令牌和 scope，然后读取受保护资源；末列自调用保留足够的标签空间'},
            {'from': 'api', 'to': 'client', 'label': '返回受保护资源', 'kind': 'reply'},
        ],
    }


class SequenceLayoutTests(unittest.TestCase):
    def test_message_time_advances_past_each_self_call(self):
        diagram = layout_sequence(boundary_content())
        previous_end = max(box['y'] + box['h'] for box in diagram['boxes'])
        for arrow in diagram['arrows']:
            start = float(arrow['from'].rsplit(':', 1)[1])
            end = float(arrow['to'].rsplit(':', 1)[1])
            self.assertGreater(start, previous_end)
            self.assertGreaterEqual(end, start)
            previous_end = end
        self.assertLess(previous_end, min(line['to'] for line in diagram['lifelines']))

    def test_unknown_participant_fails_instead_of_dropping_message(self):
        content = boundary_content()
        content['edges'][0]['to'] = 'missing-participant'
        with self.assertRaises(ValueError):
            layout_sequence(content)

    @unittest.skipUnless(shutil.which('node'), 'rendering regression requires Node >=22')
    def test_long_self_calls_and_multiline_zero_value_render_without_collisions(self):
        with tempfile.TemporaryDirectory(prefix='diagram-sequence-test-') as directory:
            root = Path(directory)
            document = {'title': '时序排版边界', 'frames': [{
                'id': 'boundary', 'title': '长自调用和多行参与者',
                'content': boundary_content(), 'diagram': {'layout': 'sequence'},
            }]}
            source = root / 'document.json'
            source.write_text(json.dumps(document, ensure_ascii=False), encoding='utf-8')
            result = subprocess.run(
                [sys.executable, str(SKILL / 'scripts/render.py'), str(source), '--out', str(root / 'out')],
                capture_output=True, text=True, timeout=60,
            )
            if 'A local Chrome, Edge or Chromium is required' in result.stderr:
                self.skipTest('rendering regression requires a local Chromium browser')
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            view = json.loads((root / 'out/report.json').read_text(encoding='utf-8'))['viewports'][0]
            self.assertEqual(view['scriptErrors'], [])
            item = view['items'][0]
            self.assertEqual(item['geometry']['errors'], [])
            self.assertEqual(item['semantic']['errors'], [])
            svg = ET.parse(root / 'out/boundary.svg')
            texts = [''.join(element.itertext()) for element in svg.iter('{http://www.w3.org/2000/svg}text')]
            self.assertIn('0', texts, 'numeric zero must remain visible in the participant header')


if __name__ == '__main__':
    unittest.main()
