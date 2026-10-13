"""Lay out standard sequence semantics for the existing diagram renderer."""
from copy import deepcopy
import math
import unicodedata


_HEADER_FONT = 20
_VALUE_FONT = 13
_MESSAGE_FONT = 14
_MARGIN = 32
_HEADER_TEXT_WIDTH = 320
_MESSAGE_TEXT_WIDTH = 420
_SELF_TEXT_WIDTH = 220
_KINDS = {'flow', 'reply', 'async', 'blocked', 'many', 'one'}
_STARTS = {'compose', 'aggregate', 'many', 'one'}
_STATUSES = {'ok', 'error', 'warn', 'muted'}
_NODE_GEOMETRY = {'x', 'y', 'w', 'h', 'shape', 'icon', 'size', 'r'}
_EDGE_GEOMETRY = {'shape', 'at', 'anchor', 'size', 'via', 'radius', 'c1', 'c2', 'bend', 'counter', 'side'}


def _text(value, field):
    if value is None:
        return ''
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        if not math.isfinite(value):
            raise ValueError(field + ' must be finite')
        return str(value)
    raise ValueError(field + ' must be text, a number, a boolean or null')


def _char_width(char, font):
    # Conservative bounds for the existing system-font stack, not font metrics.
    if unicodedata.combining(char):
        return 0
    if char.isspace():
        return font * 0.4
    if ord(char) > 127 or char in 'MWmw@%':
        return font * 1.1
    return font * 0.75


def _width(text, font):
    return sum(_char_width(char, font) for char in text)


def _wrap(text, font, maximum):
    """Keep every character; break CJK freely and English at words when possible."""
    lines = []
    for paragraph in text.split('\n'):
        tokens = []
        word = ''
        for char in paragraph:
            if char.isspace() or unicodedata.east_asian_width(char) in {'W', 'F'}:
                if word:
                    tokens.append(word)
                    word = ''
                # Normalize non-newline whitespace for predictable SVG spacing.
                tokens.append(' ' if char.isspace() else char)
            elif char in '=(,;&':
                # Break expressions at operators, not inside their identifiers.
                # Closing parentheses stay with the argument they close.
                word += char
                tokens.append(word)
                word = ''
            else:
                word += char
        if word:
            tokens.append(word)
        line = ''
        width = 0
        for token in tokens:
            token_width = _width(token, font)
            if line and width + token_width > maximum:
                lines.append(line)
                line = ''
                width = 0
            # A long identifier still has to fit; only newlines are inserted.
            for char in token:
                char_width = _char_width(char, font)
                if line and width + char_width > maximum:
                    lines.append(line)
                    line = ''
                    width = 0
                line += char
                width += char_width
        lines.append(line)
    return '\n'.join(lines)


def _extent(text, font):
    lines = text.split('\n')
    return max(_width(line, font) for line in lines), len(lines)


def _reject_geometry(item, fields, field):
    supplied = fields.intersection(item)
    if supplied:
        raise ValueError(field + ' contains manual geometry: ' + ', '.join(sorted(supplied)))


def layout_sequence(content):
    """Return a fresh diagram; node order is columns and edge order is time.

    Standard participants carry label/value/status, and messages carry label/kind
    and optional start markers. Manual geometry and compartmented participants
    require the existing manually positioned diagram interface instead.
    """
    if not isinstance(content, dict):
        raise ValueError('sequence content must be an object')
    nodes = content.get('nodes')
    edges = content.get('edges')
    if not isinstance(nodes, list) or not nodes:
        raise ValueError('sequence content.nodes must be a non-empty array')
    if not isinstance(edges, list):
        raise ValueError('sequence content.edges must be an array')

    boxes = []
    ids = set()
    header_height = 72
    for index, node in enumerate(nodes):
        field = 'sequence content.nodes[' + str(index) + ']'
        if not isinstance(node, dict):
            raise ValueError(field + ' must be an object')
        identifier = node.get('id')
        if not isinstance(identifier, str) or not identifier or identifier.strip() != identifier or '@' in identifier:
            raise ValueError(field + '.id must be a non-empty unanchored participant id')
        if identifier in ids:
            raise ValueError('duplicate sequence participant: ' + identifier)
        ids.add(identifier)
        _reject_geometry(node, _NODE_GEOMETRY, field)
        for compartment in ('fields', 'methods', 'rows'):
            if compartment in node and node[compartment] != []:
                raise ValueError(field + '.' + compartment + ' requires manual layout')
        if node.get('status') not in (None, '', *_STATUSES):
            raise ValueError(field + '.status is unsupported')
        if not isinstance(node.get('label'), str):
            raise ValueError(field + '.label must be a string')
        label = _wrap(_text(node['label'], field + '.label'), _HEADER_FONT, _HEADER_TEXT_WIDTH)
        value = _wrap(_text(node.get('value'), field + '.value'), _VALUE_FONT, _HEADER_TEXT_WIDTH)
        label_width, label_lines = _extent(label, _HEADER_FONT)
        value_width, value_lines = _extent(value, _VALUE_FONT)
        box = deepcopy(node)
        box['label'] = label
        if value:
            # Renderer centers label at cy-10 and value at cy+15. Blank-line
            # padding grows each block away from that fixed 25px separation;
            # semantic normalization ignores only this added whitespace.
            box['label'] += '\n' * (label_lines - 1)
            if isinstance(node['value'], str):
                box['value'] = '\n' * (value_lines - 1) + value
            top = 10 + (label_lines - 1) * 1.2 * _HEADER_FONT + 14
            bottom = 15 + (value_lines - 1) * 1.2 * _VALUE_FONT + 10
            required_height = 2 * (max(top, bottom) + 14)
        else:
            required_height = (label_lines - 1) * 1.2 * _HEADER_FONT + 52
        header_height = max(header_height, math.ceil(required_height))
        badge_space = 72 if node.get('status') in {'ok', 'error', 'warn'} else 40
        box['w'] = max(180, math.ceil(max(label_width, value_width) + badge_space))
        box['fill'] = node.get('fill', 'sky')
        boxes.append(box)

    messages = []
    widest_loop = 0
    for index, edge in enumerate(edges):
        field = 'sequence content.edges[' + str(index) + ']'
        if not isinstance(edge, dict):
            raise ValueError(field + ' must be an object')
        for endpoint in ('from', 'to'):
            if not isinstance(edge.get(endpoint), str) or edge[endpoint] not in ids:
                raise ValueError(field + '.' + endpoint + ' must name a declared participant')
        _reject_geometry(edge, _EDGE_GEOMETRY, field)
        if edge.get('kind') not in (None, '', *_KINDS):
            raise ValueError(field + '.kind is unsupported')
        if edge.get('start') not in (None, '', *_STARTS):
            raise ValueError(field + '.start is unsupported')
        if edge.get('label') is not None and not isinstance(edge['label'], str):
            raise ValueError(field + '.label must be a string or null')
        message = deepcopy(edge)
        label = _text(edge.get('label'), field + '.label')
        if edge['from'] == edge['to']:
            label = _wrap(label, _MESSAGE_FONT, _SELF_TEXT_WIDTH)
            message['bend'] = max(90, math.ceil(_extent(label, _MESSAGE_FONT)[0] + 44))
            widest_loop = max(widest_loop, message['bend'])
        if 'label' in edge:
            message['label'] = label
        messages.append(message)

    step = max(260, max(box['w'] for box in boxes) + 40, widest_loop + 56)
    centers = {}
    first_center = _MARGIN + boxes[0]['w'] / 2
    for index, box in enumerate(boxes):
        center = first_center + index * step
        centers[box['id']] = center
        box.update(x=center - box['w'] / 2, y=_MARGIN, h=header_height)

    cursor = _MARGIN + header_height + 12
    right = max(box['x'] + box['w'] for box in boxes)
    arrows = []
    for message in messages:
        source = message['from']
        target = message['to']
        self_message = source == target
        x1, x2 = centers[source], centers[target]
        label = message.get('label', '')
        if not self_message:
            label = _wrap(label, _MESSAGE_FONT, min(_MESSAGE_TEXT_WIDTH, abs(x2 - x1) - 48))
            if 'label' in message:
                message['label'] = label
        # SVG tspans advance exactly 1.2em; allow ink/white halo beyond that.
        label_height = (_extent(label, _MESSAGE_FONT)[1] - 1) * 1.2 * _MESSAGE_FONT + 20 if label else 0
        y = math.ceil(cursor + label_height + 24)
        end_y = y + 48 if self_message else y
        message['from'] = source + '@life:' + str(y)
        message['to'] = target + '@life:' + str(end_y)
        if label:
            label_x = x1 + message['bend'] / 2 if self_message else (x1 + x2) / 2
            message['at'] = [label_x, y - label_height / 2 - 12]
        if self_message:
            right = max(right, x1 + message['bend'])
        arrows.append(message)
        cursor = end_y

    height = math.ceil(cursor + 56)
    return {
        'w': math.ceil(right + _MARGIN),
        'h': height,
        'boxes': boxes,
        'lifelines': [{'of': box['id'], 'to': height - _MARGIN, 'end': True} for box in boxes],
        'arrows': arrows,
    }
