"""Chequeo aproximado de JSX: balance de () [] {} y de etiquetas. No reemplaza al compilador."""
import re
import sys


def scan(src):
    """Recorre el código distinguiendo JS de texto JSX de forma aproximada."""
    out = []  # (char, line) de los delimitadores y etiquetas
    i, n, line = 0, len(src), 1
    stack = []  # contexto: 'js' o 'jsx'
    mode = ['js']
    tags = []
    errors = []
    prev_sig = ''  # último carácter significativo en modo js

    def err(msg):
        errors.append(f'línea {line}: {msg}')

    brackets = []
    while i < n:
        c = src[i]
        if c == '\n':
            line += 1
        m = mode[-1]
        if m == 'js':
            if src.startswith('//', i):
                j = src.find('\n', i)
                i = n if j < 0 else j
                continue
            if src.startswith('/*', i):
                j = src.find('*/', i)
                line += src[i:j].count('\n')
                i = j + 2
                continue
            if c in '\'"`':
                q = c
                j = i + 1
                while j < n and src[j] != q:
                    if src[j] == '\\':
                        j += 1
                    elif q == '`' and src.startswith('${', j):
                        # plantilla: buscar llave de cierre simple
                        depth = 0
                        while j < n:
                            if src[j] == '{':
                                depth += 1
                            elif src[j] == '}':
                                depth -= 1
                                if depth == 0:
                                    break
                            j += 1
                    elif src[j] == '\n':
                        line += 1
                        if q != '`':
                            err('string sin cerrar')
                            break
                    j += 1
                i = j + 1
                prev_sig = 'a'
                continue
            # regex literal: / después de ( , = : [ ! & | ? { } ; return
            if c == '/' and prev_sig in ('(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '') :
                j = i + 1
                cls = False
                while j < n:
                    if src[j] == '\\':
                        j += 2
                        continue
                    if src[j] == '[':
                        cls = True
                    elif src[j] == ']':
                        cls = False
                    elif src[j] == '/' and not cls:
                        break
                    elif src[j] == '\n':
                        break
                    j += 1
                i = j + 1
                while i < n and src[i].isalpha():
                    i += 1
                prev_sig = 'a'
                continue
            # inicio de etiqueta JSX: < seguido de letra, > o / , y contexto de expresión
            if c == '<' and prev_sig in ('(', ',', '=', ':', '?', '&', '|', '{', '}', '>', ';', 'return', '') and re.match(r'<[A-Za-z>/]', src[i:i + 2]):
                tag_end = parse_tag(src, i)
                if tag_end is None:
                    err('etiqueta mal formada')
                    i += 1
                    continue
                name, closing, selfclose, j, inner_exprs = tag_end
                line += src[i:j].count('\n')
                for e_line_err in inner_exprs:
                    errors.append(f'línea {line}: {e_line_err}')
                if closing:
                    if not tags or tags[-1][0] != name:
                        err(f'cierre </{name}> sin apertura (abierta: {tags[-1] if tags else None})')
                    else:
                        tags.pop()
                        if tags and tags[-1][2] == len(mode):
                            pass
                    if tags and tags[-1][2] == len(mode) - 0:
                        pass
                    # al cerrar la etiqueta raíz de este nivel volvemos a js
                    if not tags or tags[-1][2] < len(mode):
                        if mode[-1] == 'jsxtext':
                            mode.pop()
                elif not selfclose:
                    tags.append((name, line, len(mode) + 1))
                    mode.append('jsxtext')
                i = j
                prev_sig = '>'
                continue
            if c in '([{':
                brackets.append((c, line))
            elif c in ')]}':
                if not brackets:
                    err(f'{c} de más')
                else:
                    o, l = brackets.pop()
                    if '([{'.index(o) != ')]}'.index(c):
                        err(f'{c} no coincide con {o} de la línea {l}')
                    if c == '}' and stack and stack[-1] == len(brackets):
                        stack.pop()
                        mode.pop()  # volvemos a texto JSX
                        i += 1
                        prev_sig = '}'
                        continue
            if not c.isspace():
                if src.startswith('return', i) and not re.match(r'\w', src[i + 6:i + 7] or ' '):
                    prev_sig = 'return'
                    i += 6
                    continue
                prev_sig = c if not (c.isalnum() or c in '_$.') else 'a'
            i += 1
        else:  # texto JSX
            if c == '{':
                brackets.append(('{', line))
                stack.append(len(brackets) - 1)
                mode.append('js')
                prev_sig = '{'
                i += 1
                continue
            if c == '<':
                tag_end = parse_tag(src, i)
                if tag_end is None:
                    err('etiqueta mal formada en texto')
                    i += 1
                    continue
                name, closing, selfclose, j, inner_exprs = tag_end
                line += src[i:j].count('\n')
                for e_line_err in inner_exprs:
                    errors.append(f'línea {line}: {e_line_err}')
                if closing:
                    if not tags or tags[-1][0] != name:
                        err(f'cierre </{name}> no coincide con {tags[-1] if tags else None}')
                    else:
                        tags.pop()
                    if not tags or tags[-1][2] < len(mode):
                        mode.pop()
                elif not selfclose:
                    tags.append((name, line, len(mode) + 1))
                    mode.append('jsxtext')
                i = j
                continue
            i += 1
    if brackets:
        errors.append(f'quedaron abiertos: {brackets[-5:]}')
    if tags:
        errors.append(f'etiquetas sin cerrar: {tags[-5:]}')
    return errors


def parse_tag(src, i):
    """Lee una etiqueta desde '<'. Devuelve (nombre, es_cierre, autocierre, fin, errores)."""
    j = i + 1
    closing = False
    if src[j] == '/':
        closing = True
        j += 1
    m = re.match(r'[A-Za-z][\w.]*|', src[j:])
    name = m.group(0)
    j += len(name)
    errs = []
    depth = 0
    while j < len(src):
        c = src[j]
        if depth == 0 and c in '"\'':
            k = src.find(c, j + 1)
            j = k + 1
            continue
        if c == '{':
            # expresión dentro de un atributo: saltar balanceando, ignorando strings simples
            d = 0
            while j < len(src):
                ch = src[j]
                if ch in '\'"`':
                    k = j + 1
                    while k < len(src) and src[k] != ch:
                        if src[k] == '\\':
                            k += 1
                        k += 1
                    j = k + 1
                    continue
                if ch == '{':
                    d += 1
                elif ch == '}':
                    d -= 1
                    if d == 0:
                        break
                j += 1
            j += 1
            continue
        if c == '/' and src[j + 1:j + 2] == '>':
            return name, closing, True, j + 2, errs
        if c == '>':
            return name or '<>', closing, False, j + 1, errs
        j += 1
    return None


for f in sys.argv[1:]:
    src = open(f, encoding='utf-8').read()
    errs = scan(src)
    print(('OK   ' if not errs else 'MAL  ') + f)
    for e in errs[:8]:
        print('     ', e)
