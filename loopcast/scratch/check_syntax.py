with open('d:/VideoTools/StreamFlow Studio/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

script_start = content.find('<script>')
script_end = content.rfind('</script>')
js_code = content[script_start+8:script_end]

stack = []
pairs = {'{': '}', '(': ')', '[': ']'}
in_string = None
escaped = False

i = 0
n = len(js_code)
while i < n:
    ch = js_code[i]
    if in_string:
        if escaped:
            escaped = False
        elif ch == '\\':
            escaped = True
        elif ch == in_string:
            in_string = None
    else:
        # Check comments
        if ch == '/' and i + 1 < n and js_code[i+1] == '/':
            # Single line comment, skip to newline
            next_nl = js_code.find('\n', i)
            if next_nl == -1: break
            i = next_nl
            continue
        elif ch == '/' and i + 1 < n and js_code[i+1] == '*':
            # Multi-line comment, skip to */
            end_c = js_code.find('*/', i + 2)
            if end_c == -1: break
            i = end_c + 1
            i += 1
            continue
        elif ch in ('"', "'", '`'):
            in_string = ch
        elif ch in pairs:
            stack.append((ch, i))
        elif ch in pairs.values():
            if stack and pairs[stack[-1][0]] == ch:
                stack.pop()
            else:
                l = js_code[:i].count('\n') + 1
                print(f'Mismatched closing {ch} at line {l}')
    i += 1

print('Remaining unclosed items in stack:', len(stack))
for ch, idx in stack:
    l = js_code[:idx].count('\n') + 1
    print(f'{ch} at line {l}')
