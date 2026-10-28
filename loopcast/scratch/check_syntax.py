import re

with open('loopcast/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

scripts = re.findall(r'<script>(.*?)</script>', text, re.DOTALL)
print(f"Found {len(scripts)} inline script tag(s).")

for idx, s in enumerate(scripts):
    stack = []
    lines = s.split('\n')
    in_block_comment = False
    in_string = None
    escaped = False
    for line_num, line in enumerate(lines, 1):
        i = 0
        while i < len(line):
            ch = line[i]
            if in_block_comment:
                if line[i:i+2] == '*/':
                    in_block_comment = False
                    i += 2
                    continue
                i += 1
                continue
            if in_string:
                if escaped:
                    escaped = False
                elif ch == '\\':
                    escaped = True
                elif ch == in_string:
                    in_string = None
                i += 1
                continue
            if line[i:i+2] == '/*':
                in_block_comment = True
                i += 2
                continue
            if line[i:i+2] == '//':
                break
            if ch in ('"', "'", '`'):
                in_string = ch
                i += 1
                continue
            if ch in '([{':
                stack.append((ch, line_num))
            elif ch in ')]}':
                if not stack:
                    print(f"Unmatched closing {ch} at line {line_num}")
                else:
                    open_ch, open_line = stack.pop()
                    match = {'(': ')', '[': ']', '{': '}'}[open_ch]
                    if match != ch:
                        print(f"Mismatched {open_ch} (line {open_line}) with {ch} (line {line_num})")
            i += 1
    if stack:
        print(f"Unclosed brackets in script {idx}: count={len(stack)}")
        for open_ch, open_line in stack[-5:]:
            print(f"  Unclosed {open_ch} opened at line {open_line}")
    else:
        print(f"Script {idx}: All brackets perfectly balanced!")
