# 使い方: python3 tools/extract_texts.py <purinフォルダ> <出力.xlsx>（openpyxl が必要）
"""ソースからユーザーに表示される可能性のある日本語テキストを抽出し、Excelにまとめる。"""
import re
import sys
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation

SRC = Path(sys.argv[1])
OUT = sys.argv[2]
JP = re.compile(r'[぀-ヿ一-鿿]')

FILES = ['index.html', 'js/icons.js', 'js/stage.js', 'js/main.js', 'js/actions.js', 'js/texts.js', 'js/repair.js',
         'js/cooking.js', 'js/judge.js', 'js/data.js', 'js/model.js']

# ---- 文字列リテラルの切り出し（コメントは除外） ----------------------
def scan_line(line):
    """1行から (文字列, 開始位置) を返す。// 以降のコメントは無視。"""
    out = []
    i = 0
    n = len(line)
    while i < n:
        ch = line[i]
        if ch == '/' and i + 1 < n and line[i + 1] == '/':
            break
        if ch in '\'"`':
            q = ch
            j = i + 1
            buf = ''
            while j < n:
                if line[j] == '\\':
                    buf += line[j:j + 2]
                    j += 2
                    continue
                if line[j] == q:
                    break
                buf += line[j]
                j += 1
            out.append((buf, i))
            i = j + 1
            continue
        i += 1
    return out

def html_texts(line):
    # HTMLのタグ間テキスト・属性値の日本語
    res = []
    for m in re.finditer(r'>([^<>]*)<', line):
        t = m.group(1).strip()
        if JP.search(t):
            res.append(t)
    for m in re.finditer(r'(?:aria-label|title)="([^"]*)"', line):
        if JP.search(m.group(1)):
            res.append(m.group(1))
    return res

def clean(t):
    t = t.replace('\\n', ' ')
    return t


# ---- ファイル全体の字句解析（複数行のテンプレート文字列にも対応） ----
def tokenize(src):
    """(文字列の中身, 開始行, 開始列) のリストを返す。テンプレート文字列は ${} の外側だけを1つの文字列とし、
    ${} の中の文字列は別の要素として返す。"""
    out = []
    n = len(src)
    line_starts = [0]
    for idx, ch in enumerate(src):
        if ch == '\n':
            line_starts.append(idx + 1)
    import bisect
    def pos2line(p):
        k = bisect.bisect_right(line_starts, p) - 1
        return k + 1, p - line_starts[k]

    def skip_expr(i, depth_close='}'):
        # JS 式を読み、対応する閉じ括弧の位置を返す（中の文字列は out に入れる）
        depth = 0
        while i < n:
            ch = src[i]
            if ch in '\'"':
                i = read_quote(i)
                continue
            if ch == '`':
                i = read_template(i)
                continue
            if ch == '{':
                depth += 1
            elif ch == '}':
                if depth == 0:
                    return i
                depth -= 1
            i += 1
        return i

    def read_quote(i):
        q = src[i]
        j = i + 1
        buf = ''
        while j < n and src[j] != q and src[j] != '\n':
            if src[j] == '\\':
                buf += src[j:j + 2]
                j += 2
                continue
            buf += src[j]
            j += 1
        out.append((buf, *pos2line(i)))
        return j + 1

    def read_template(i):
        j = i + 1
        buf = ''
        while j < n and src[j] != '`':
            if src[j] == '\\':
                buf += src[j:j + 2]
                j += 2
                continue
            if src.startswith('${', j):
                end = skip_expr(j + 2)
                buf += '${' + src[j + 2:end] + '}'
                j = end + 1
                continue
            buf += src[j]
            j += 1
        out.append((buf, *pos2line(i)))
        return j + 1

    i = 0
    while i < n:
        if src.startswith('//', i):
            i = src.find('\n', i)
            if i < 0:
                break
            continue
        if src.startswith('/*', i):
            i = src.find('*/', i) + 2
            continue
        ch = src[i]
        if ch in '\'"':
            i = read_quote(i)
            continue
        if ch == '`':
            i = read_template(i)
            continue
        i += 1
    return out

# ---- 場面の対応表 --------------------------------------------------
SCENE = {
    ('js/main.js', 'hud'): ('ゲーム画面', '上部（ステージ・時間・満腹度）'),
    ('js/main.js', 'FLAG_SVG'): ('ゲーム画面', '判断の目印アイコン（読み上げ用ラベル）'),
    ('js/main.js', 'fridge'): ('ゲーム画面', '冷蔵庫・扉の演出'),
    ('js/main.js', 'checkPanel'): ('詳細シート', '「調べる・食べる」タブ'),
    ('js/main.js', 'actButton'): ('詳細シート', '「調べる・食べる」タブのボタン'),
    ('js/main.js', 'ACT_GROUPS'): ('詳細シート', '「調べる・食べる」タブの分類名'),
    ('js/main.js', 'PRESS_LABEL'): ('詳細シート', '「押す」の強さ'),
    ('js/main.js', 'ingChip'): ('詳細シート', '「作り直す」タブの材料'),
    ('js/main.js', 'stepButton'): ('詳細シート', '「作り直す」タブの工程'),
    ('js/icons.js', 'riskDots'): ('詳細シート', '崩れやすさの点（読み上げ用ラベル）'),
    ('js/cooking.js', 'ING_GROUPS'): ('詳細シート', '「作り直す」タブの材料の分類名'),
    ('js/main.js', 'fixPanel'): ('詳細シート', '「直す・隠す」タブ'),
    ('js/main.js', 'cookButtons'): ('詳細シート', '「作り直す」タブのボタン'),
    ('js/main.js', 'cookPanel'): ('詳細シート', '「作り直す」タブ'),
    ('js/main.js', 'sheet'): ('詳細シート', '見出し・メモ・タブ'),
    ('js/main.js', 'condText'): ('ゲーム画面／詳細シート', '見た目の状態表示'),
    ('js/main.js', 'itemName'): ('詳細シート', 'デザートの名前表示'),
    ('js/main.js', 'GUESS'): ('詳細シート', '判断の目印ボタン'),
    ('js/main.js', 'zukanPage'): ('図鑑', 'ページ本文'),
    ('js/main.js', 'zukan'): ('図鑑', '本の枠（見出し・ページ送り）'),
    ('js/main.js', 'gameScreen'): ('ゲーム画面', '下部ボタン'),
    ('js/main.js', 'titleScreen'): ('タイトル画面', '説明・開始ボタン'),
    ('js/main.js', 'resultButtons'): ('結果画面', 'ボタン'),
    ('js/main.js', 'resultScreen'): ('結果画面', '表・見出し'),
    ('js/main.js', 'render'): ('全画面', '図鑑ボタン'),
    ('js/main.js', 'click'): ('ゲーム画面', '確認ダイアログ'),
    ('js/stage.js', 'orderMemo'): ('ゲーム画面', '妹のメモ（お題）'),
    ('js/actions.js', 'ACTIONS'): ('詳細シート', '鑑定ボタン名'),
    ('js/actions.js', 'perform'): ('詳細シート', '鑑定結果（完食）'),
    ('js/texts.js', 'AROMA_SMELL'): ('詳細シート', '鑑定結果：においを嗅ぐ（香り）'),
    ('js/texts.js', 'AROMA_TASTE'): ('詳細シート', '鑑定結果：味見・完食（香り）'),
    ('js/texts.js', 'lookText'): ('詳細シート', '鑑定結果：観察する'),
    ('js/texts.js', 'smellText'): ('詳細シート', '鑑定結果：においを嗅ぐ'),
    ('js/texts.js', 'shakeText'): ('詳細シート', '鑑定結果：揺らす'),
    ('js/texts.js', 'pressWeakText'): ('詳細シート', '鑑定結果：弱く押す（普通に押すでも出る）'),
    ('js/texts.js', 'recoveryText'): ('詳細シート', '鑑定結果：普通に押す・全力で押す（戻り方）'),
    ('js/texts.js', 'pressNormalText'): ('詳細シート', '鑑定結果：普通に押す'),
    ('js/texts.js', 'pressStrongText'): ('詳細シート', '鑑定結果：全力で押す'),
    ('js/texts.js', 'sectionText'): ('詳細シート／結果画面', '鑑定結果：すくう・切る（結果画面の手掛かりにも出る）'),
    ('js/texts.js', 'cutText'): ('詳細シート', '鑑定結果：切る'),
    ('js/texts.js', 'tasteText'): ('詳細シート／結果画面', '鑑定結果：味見する・完食する（結果画面の手掛かりにも出る）'),
    ('js/repair.js', 'REPAIRS'): ('詳細シート', '「直す・隠す」ボタン名'),
    ('js/repair.js', 'repair'): ('詳細シート', '修復の結果'),
    ('js/cooking.js', 'COOK'): ('詳細シート', '「作り直す」ボタン名'),
    ('js/cooking.js', 'CREAM_CHOICES'): ('詳細シート', '生クリームの選択肢'),
    ('js/cooking.js', 'cookStatus'): ('詳細シート', 'ボウル・容器の状態'),
    ('js/cooking.js', 'cook'): ('詳細シート', '作り直しの結果'),
    ('js/judge.js', 'judge'): ('結果画面', '判定の見出し・理由・表'),
    ('js/data.js', 'LABEL'): ('全画面', 'デザート名'),
    ('js/data.js', 'MAT_LABEL'): ('詳細シート', '修復材料の名前（現在は画面に未使用）'),
    ('js/data.js', 'COOK_TIPS'): ('図鑑', '調理の基本'),
    ('js/data.js', 'ZUKAN_ING'): ('図鑑', '主な材料'),
    ('js/data.js', 'ZUKAN_BASE'): ('図鑑', 'どんなもの（1文の説明）'),
    ('js/data.js', 'ZUKAN'): ('図鑑', '特徴'),
    ('index.html', '-'): ('ブラウザ', 'タブの題名'),
}

AXIS = {
    'egg': '卵感', 'fat': '乳脂肪', 'air': '気泡', 'firm': '硬さ', 'elastic': '弾力', 'su': 'す（小さな穴）',
    'syneresis': '離水', 'almond': 'アーモンド香', 'annin': '杏仁香', 'coffee': 'コーヒー', 'citrus': 'レモン',
    'yogurt': 'ヨーグルト', 'rose': 'ローズ', 'coconut': 'ココナッツ', 'ginger': 'ショウガ', 'fruit': '果物',
    'crust': '焦げた膜', 'yellow': '黄色み', 'gloss': 'つや', 'water': '水分（見た目）', 'brown': '茶色', 'pink': 'ピンク',
    'amount': '残量', 'shape': '原形', 'whip': 'ホイップ', 'caramel': 'カラメル', 'sauce': 'ソース',
}
SET = {'agar': '寒天', 'gelatin': 'ゼラチン', 'egg_heat': '卵の加熱', 'starch': 'でんぷん', 'acid': '酸（レモン）',
       'enzyme': '酵素（ショウガ）', 'none': '固まっていない'}

LOCAL = {
    'lookText': {'y': '黄色み（揺らぎ込み）', 'g': 'つや（揺らぎ込み）'},
    'smellText': {'e': '卵感（揺らぎ込み）'},
    'pressWeakText': {'f': '硬さ（揺らぎ込み）'},
    'recoveryText': {'e': '弾力（揺らぎ込み）'},
    'tasteText': {'e': '卵感（揺らぎ込み）', 'ft': '乳脂肪（揺らぎ込み）'},
    'condText': {'a': '見た目の残量', 's': '見た目の原形'},
}
# 結果画面などは、条件を個別に言い換える（文の先頭で判定）
# 結果画面の表（judge.js）の各セルの条件
JUDGE_COND = {
    '完食': '表の「帰宅時の見た目」：完食して空のとき',
    '大きく崩れて見える': '表の「帰宅時の見た目」：見た目の原形85未満か、見た目の残量0.95未満',
    '少し跡が見える': '表の「帰宅時の見た目」：見た目の原形96未満か、見た目の残量0.99未満（大きく崩れて見える以外）',
    '無傷に見える': '表の「帰宅時の見た目」：上のどちらでもないとき',
    '作り直し': '表の「帰宅時の見た目」の後ろに、その修復をしていれば（）で付く',
    'ホイップ': '表の「帰宅時の見た目」の後ろに、その修復をしていれば（）で付く',
    'ソース': '表の「帰宅時の見た目」の後ろに、その修復をしていれば（）で付く',
    '容器替え': '表の「帰宅時の見た目」の後ろに、その修復をしていれば（）で付く',
    '移植': '表の「帰宅時の見た目」の後ろに、その修復をしていれば（）で付く',
    '（${fixes.join(\'・\')}）': '修復をしていたとき、見た目の後ろに付く',
    '（空の容器）': '表の「妹の判断」：完食して空のとき',
}
TEXT_COND = [
    ('${ADD_LABEL[a.id]}を入れた', '材料「寒天」「コーンスターチ」を加えたとき（${…}は材料名）'),
    ('${ADD_LABEL[a.id]}を加えた', 'ゼラチン・寒天・コーンスターチ・ショウガ汁以外の材料を加えたとき（${…}は材料名）'),
    ('${LABEL[name]}は${need}個必要なのに', '残すべきデザートが、妹から見て必要な数より少ないとき（デザートの種類ごとに1行）'),
    ('${i.id}は残っていたが', '残すべきデザートが残っていたのに、妹には別のものに見えたとき（その個体ごとに1行）'),
    ('発覚：${shortNames', '残すべきデザートが、妹から見て必要な数より少ないとき（見出し）'),
    ('発覚：手を付けた跡', '数は足りるが、大きく崩れて見えるものを数に入れないと足りないとき（見出し）'),
    ('${majorItems', '数は足りるが、大きく崩れて見えるものを数に入れないと足りないとき'),
    ('失敗：空腹のまま', '言いつけは守ったが、満腹度が「満足」に届かないとき（見出し）'),
    ('言いつけは守ったが', '言いつけは守ったが、満腹度が「満足」に届かないとき'),
    ('成功：ただし痕跡あり', '少し跡が見えるものを数に入れないと足りないとき（見出し）'),
    ('${minorItems', '少し跡が見えるものを数に入れないと足りないとき'),
    ('完全犯罪', '上のどれにも当てはまらないとき（見出し）'),
    ('妹は満足そうに', '上のどれにも当てはまらないとき'),
]
CASE_JP = {
    'look': '観察する', 'sniff': 'においを嗅ぐ', 'shake': '揺らす', 'press1': '弱く押す', 'press2': '普通に押す',
    'press3': '全力で押す', 'scoop': 'すくう', 'cut': '切る', 'taste': '味見する', 'eat': '完食する',
    'whip': 'ホイップで隠す', 'sauce': 'ソースをかける', 'graft': '別のデザートから移植', 'cup': '小さい容器に移す',
    'whipped': '生クリームを泡立てて加える', 'warm': '温める', 'boil': '煮立てる', 'cool': '粗熱を取る', 'discard': '捨てる',
    'pour': '容器に流す', 'steam': '蒸す', 'chill': '冷蔵庫で冷やす', 'freeze': '冷凍庫で急冷', 'brulee': '表面を焦がす',
    'keepAll': '「Xは食べないで」', 'keepTwo': '「XとYは食べないで」', 'keepN': '「Xをn個残して」', 'onlyEat': '「食べていいのはXだけ」',
}

def explain(cond, func=''):
    """コード上の条件を、ざっくり日本語に言い換える。"""
    if not cond:
        return ''
    t = cond
    mcase = re.match(r"case '(\w+)'(?: / (.*))?", t)
    if mcase:
        head = f"「{CASE_JP.get(mcase.group(1), mcase.group(1))}」を選んだとき"
        return head + (f'。{explain(mcase.group(2), func)}' if mcase.group(2) else '')
    for k, v in LOCAL.get(func.split('.')[0], {}).items():
        t = re.sub(rf'\b{k}\b', v, t)
    t = re.sub(r'chance\(([\d.]+)\)', lambda m: f'{int(float(m.group(1)) * 100)}%の確率で追加', t)
    t = re.sub(r"(\w+)\.set === '(\w+)'", lambda m: f"固め方が「{SET.get(m.group(2), m.group(2))}」", t)
    t = re.sub(r"(\w+)\.set !== '(\w+)'", lambda m: f"固め方が「{SET.get(m.group(2), m.group(2))}」以外", t)
    t = re.sub(r"\((\w+)\.(\w+) \|\| 0\)", lambda m: AXIS.get(m.group(2), m.group(2)), t)
    ING = {'whole': '全卵', 'yolk': '卵黄', 'white': '卵白', 'milk': '牛乳', 'cream': '生クリーム', 'gelatin': 'ゼラチン',
           'agar': '寒天', 'starch': 'コーンスターチ', 'almond': 'アーモンドエッセンス', 'annin': '杏仁霜', 'coffee': 'コーヒー',
           'lemon': 'レモン汁', 'yogurt': 'ヨーグルト', 'rose': 'ローズウォーター', 'coconut': 'ココナッツミルク',
           'ginger': 'ショウガ汁', 'berry': 'ベリー', 'whipped': '泡立てた生クリーム'}
    FLAG = {'warm': 'ボウルが温かい', 'gelDissolved': 'ゼラチンが溶けた', 'agarBoiled': '寒天を煮立てた',
            'starchBoiled': 'でんぷんを煮立てた', 'scrambled': '卵がぼそぼそ', 'whipAir': '泡がある', 'enzymeSet': 'ショウガで固まりかけ',
            'crust': '膜がある', 'stage': '工程の段階', 'gingerDead': 'ショウガの力がない'}
    t = re.sub(r"\bc\.stage === 'cup'", '容器に流した後', t)
    t = re.sub(r"\bc\.stage === 'bowl'", 'ボウルの段階', t)
    t = re.sub(r"\bg\.(\w+)", lambda m: f"「{ING.get(m.group(1), m.group(1))}」を入れた", t)
    t = re.sub(r"\bc\.(\w+)", lambda m: FLAG.get(m.group(1), m.group(1)), t)
    t = re.sub(r"hasEgg\(g\)", '卵が入っている', t)
    t = re.sub(r"fragility\((\w+)\) > 1", '崩れやすいデザート', t)
    t = t.replace('isMajor(i)', '大きく崩れて見える').replace('isMinor(i)', '少し跡が見える')
    t = re.sub(r"canCook\([^)]*\)", '選べる状態', t).replace('canRepair(state, it, r)', '選べる状態')
    t = re.sub(r"\b(?:it|f|b|state|i)\.(\w+)", lambda m: AXIS.get(m.group(1), m.group(1)), t)
    t = t.replace(' + jit()', '（揺らぎ±0.07）').replace(' * k', '（ホイップ時は半分）')
    t = t.replace('&&', 'かつ').replace('||', 'または').replace('!==', '≠').replace('===', '＝')
    t = re.sub(r'!([^\s()]+(?:\([^)]*\))?)', lambda m: f'「{m.group(1)}」でない', t)
    return t

FUNC_RE = re.compile(r'^(?:export\s+)?(?:async\s+)?function\s+(\w+)')
CONST_RE = re.compile(r'^(?:export\s+)?(?:const|let)\s+(\w+)\s*=')
KEY_RE = re.compile(r'^\s{2}(\w+):\s*[\[\'{(]')
COND_RE = re.compile(r'(?:else\s+)?if\s*\((.*)\)\s*(?:\{|return|out\.push|feats\.push|rest\.push|brk\s*=|lines\.push|\w)')
CASE_RE = re.compile(r"case\s+'([^']+)'")

rows = []
for rel in FILES:
    path = SRC / rel
    src = path.read_text(encoding='utf-8')
    lines = src.splitlines()
    # 1) 行ごとの文脈（どの定義の中か・直前の条件・case）を求める
    func = '-'
    subkey = ''
    last_cond = ''
    last_case = ''
    state = {}
    for no, line in enumerate(lines, 1):
        stripped = line.strip()
        m = FUNC_RE.match(line)
        if m:
            func, subkey, last_cond, last_case = m.group(1), '', '', ''
        else:
            m = CONST_RE.match(line)
            if m and not line.startswith(' '):
                func, subkey, last_cond, last_case = m.group(1), '', '', ''
        if rel == 'js/main.js' and "addEventListener('click'" in line:
            func = 'click'
        if rel == 'js/main.js' and re.match(r'^const (itemName|animFor)', line):
            func = re.match(r'^const (\w+)', line).group(1)
        mk = KEY_RE.match(line)
        if mk and func in ('LABEL', 'ZUKAN', 'ZUKAN_BASE', 'ZUKAN_ING', 'AROMA_SMELL', 'AROMA_TASTE', 'COOK'):
            subkey = mk.group(1)
        mc = CASE_RE.search(line)
        if mc:
            last_case = mc.group(1)
            last_cond = ''
        mi = COND_RE.search(stripped)
        if mi and ('if' in stripped):
            last_cond = mi.group(1)
            depth = 0
            for idx, ch in enumerate(last_cond):
                if ch == '(':
                    depth += 1
                elif ch == ')':
                    if depth == 0:
                        last_cond = last_cond[:idx]
                        break
                    depth -= 1
        elif stripped.startswith('} else {') or stripped == 'else' or stripped.startswith('else '):
            last_cond = f'上の条件に当てはまらない（{last_cond}）' if last_cond and not last_cond.startswith('上の') else last_cond
        state[no] = (func, subkey, last_cond, last_case)

    # 2) 文字列を拾う
    if rel == 'index.html':
        toks = [(t, no, 0) for no, line in enumerate(lines, 1) for t in html_texts(line)]
    else:
        toks = []
        for t, ln, col in tokenize(src):
            if not JP.search(t):
                continue
            if '<' in t:
                # HTMLを含むテンプレート：タグを除いた文字部分と、読み上げ用ラベルを別々に拾う
                offset = 0
                for part in re.split(r'(<[^>]*>)', t):
                    seg_line = ln + t[:offset].count('\n')
                    if part.startswith('<'):
                        for m in re.finditer(r'aria-label="([^"]*)"', part):
                            if JP.search(m.group(1)):
                                toks.append((m.group(1), seg_line, -1))
                    else:
                        seg = part.strip()
                        if '}>' in seg:
                            seg = seg.split('}>')[-1].strip()  # タグ内の ${…>…} で途切れた分を除く
                        # ${…} の中だけに日本語がある部分は、中の文字列として別に拾うので除く
                        if seg.startswith('${') and seg.endswith('}') and '?' in seg:
                            pass  # 条件で切り替わる部分は、中の文字列として別に拾う
                        elif JP.search(re.sub(r'\$\{[^}]*\}', '', seg)):
                            toks.append((' '.join(seg.split()), seg_line + part[:part.find(seg[:1])].count('\n') if seg else seg_line, -1))
                    offset += len(part)
            else:
                toks.append((t, ln, col))

    for t, no, pos in toks:
        if rel == 'index.html' and 'フォント' in t:
            continue
        func, subkey, last_cond, last_case = state.get(no, ('-', '', '', ''))
        line = lines[no - 1] if no - 1 < len(lines) else ''
        stripped = line.strip()
        scene, place = SCENE.get((rel, func), ('', func))
        if rel == 'js/data.js' and func not in [k[1] for k in SCENE if k[0] == 'js/data.js']:
            continue  # 定義・内部用の文字列は対象外
        if rel == 'js/model.js' or t.startswith('生成失敗') or rel in ('js/main.js',) and func == 'animFor':
            continue  # 内部用（画面には出ない）
        if not scene:
            continue
        # 条件
        cond = ''
        if pos >= 0:
            m_same = COND_RE.search(stripped)
            before = line[:pos]
            tern = re.search(r'(?:\(|=|return|push\(|\$\{)\s*([^()?]*(?:\([^()]*\)[^()?]*)*?)\s\?\s', before)
            if m_same and 'if' in stripped:
                cond = last_cond
                if re.search(r'\belse\b', before[before.find('if'):]):
                    cond = f'上の条件に当てはまらない（{last_cond}）'
            elif tern or (' ? ' in line and ' : ' in before):
                tm = re.search(r'(?:\(|=|return|push\(|\$\{)\s*([^()?]*(?:\([^()]*\)[^()?]*)*?)\s\?\s', line)
                expr = tm.group(1).strip() if tm else '?'
                if '=>' in expr or '<' in expr or '`' in expr:
                    inner = re.findall(r'\$\{\s*([\w.]+(?: [=!<>]+ [\w.\']+)?)\s\?', line)
                    expr = inner[-1] if inner else '同じ行の条件'
                after_q = before[before.rfind(' ? '):] if ' ? ' in before else ''
                cond = expr if ' : ' not in after_q else f'上の条件に当てはまらない（{expr}）'
            elif last_cond and (stripped.startswith('return') or stripped.startswith('else')):
                cond = f'上の条件に当てはまらない（{last_cond}）'
            elif last_cond and rel == 'js/judge.js' and not stripped.startswith('const'):
                cond = last_cond
        if func in ('AROMA_SMELL', 'AROMA_TASTE'):
            cond = f'it.{subkey} > 0.35'
        if last_case and func in ('cook', 'repair', 'perform', 'orderMemo'):
            cond = f"case '{last_case}'" + (f' / {cond}' if cond else '')
        how = '候補からランダムに1つ（同じ配列の他の文と入れ替わる）' if 'say([' in line or (func in ('AROMA_SMELL', 'AROMA_TASTE')) else ''
        if len(t.strip()) <= 1:
            how = '複数の名前・記号を並べるときの区切り文字'
        if not t.strip():
            continue
        if func in ('lookText', 'smellText') and how:
            how += '。観察・においは、出た特徴の中から一部だけが表示される'
        ph = '、'.join(sorted(set(re.findall(r'\$\{([^}]*)\}', t))))
        sub = f'{func}.{subkey}' if subkey else func
        rows.append({
            'scene': scene, 'place': place, 'file': rel, 'line': no, 'func': sub,
            'text': clean(t), 'cond': cond,
            'override': (JUDGE_COND.get(t) if rel == 'js/judge.js' else None) or next((d for pre, d in TEXT_COND if t.startswith(pre)), None),
            'cond_jp': (f'{AXIS.get(subkey, subkey)}の香り（内部値）が0.35超' if func in ('AROMA_SMELL', 'AROMA_TASTE')
                        else explain(cond, func)),
            'how': how, 'ph': ph,
        })

# 重複（同じ行の同じ文字列）を除く
seen = set()
uniq = []
for r in rows:
    k = (r['file'], r['line'], r['text'])
    if k in seen:
        continue
    seen.add(k)
    uniq.append(r)
rows = uniq

# ---- Excel --------------------------------------------------------
wb = Workbook()
F = 'Arial'
head_fill = PatternFill('solid', fgColor='C0503A')
input_fill = PatternFill('solid', fgColor='FFF6CC')
thin = Side(style='thin', color='D9D9D9')
border = Border(left=thin, right=thin, top=thin, bottom=thin)

ws0 = wb.active
ws0.title = '説明'
guide = [
    ('表示テキスト一覧（「プリンは食べないで」試作版）', True),
    ('', False),
    ('ゲーム内でユーザーに表示される可能性のある文字列を、ソースコードから全件抽出したものです。', False),
    ('「テキスト一覧」シートの黄色い列（修正案・メモ）に記入してください。空欄の行は現状のままにします。', False),
    ('記入したファイルを渡してもらえれば、ファイル名と行番号をもとにソースへ反映します。', False),
    ('', False),
    ('列の見方', True),
    ('No：通し番号', False),
    ('画面：表示される画面', False),
    ('場面：画面の中のどこか、どの鑑定の結果か', False),
    ('ファイル・行・定義：ソースコード上の位置（反映用。編集不要）', False),
    ('表示テキスト：現在の文字列。${…} は表示時に差し込まれる値（例：${LABEL[n]} → デザート名）', False),
    ('表示条件（コード）：その文が出る条件をコードのまま記載。数値は内部値（0〜1）', False),
    ('表示条件（言い換え）：条件をざっくり日本語にしたもの。正確にはコード側を参照', False),
    ('選ばれ方：「候補からランダムに1つ」は、同じ条件の候補の中から毎回1つが選ばれる言い回しの候補', False),
    ('差し込み：表示時に置き換わる部分', False),
    ('修正案：新しい文言を記入（黄色）', False),
    ('メモ：補足や「削除したい」などの指示（黄色）', False),
    ('', False),
    ('記入例', True),
    ('表示テキスト「卵の匂いがはっきりする。」 → 修正案「卵のやさしい香りがふわっと立つ。」', False),
    ('', False),
    ('注意', True),
    ('・言い回しの候補は、増やしたい場合はメモ欄に追加分を書いてください（例：「候補追加：〇〇」）。', False),
    ('・「内部値」の意味は「用語」シートを参照してください。', False),
    (f'・抽出件数：{len(rows)}件', False),
]
for i, (t, bold) in enumerate(guide, 1):
    c = ws0.cell(row=i, column=1, value=t)
    c.font = Font(name=F, bold=bold, size=12 if bold else 11, color='C0503A' if bold else '000000')
ws0.column_dimensions['A'].width = 110

ws = wb.create_sheet('テキスト一覧')
headers = ['No', '画面', '場面', 'ファイル', '行', '定義', '表示テキスト', '表示条件（コード）', '表示条件（言い換え）',
           '選ばれ方', '差し込み', '修正案', 'メモ']
widths = [6, 16, 30, 14, 6, 20, 46, 40, 40, 30, 18, 46, 24]
for j, h in enumerate(headers, 1):
    c = ws.cell(row=1, column=j, value=h)
    c.font = Font(name=F, bold=True, color='FFFFFF')
    c.fill = head_fill
    c.alignment = Alignment(vertical='center', wrap_text=True)
    c.border = border
    ws.column_dimensions[c.column_letter].width = widths[j - 1]

order = ['ブラウザ', 'タイトル画面', 'ゲーム画面', 'ゲーム画面／詳細シート', '詳細シート', '詳細シート／結果画面', '結果画面', '図鑑', '全画面']
rows.sort(key=lambda r: (order.index(r['scene']) if r['scene'] in order else 99, r['file'], r['line']))
for i, r in enumerate(rows, 2):
    vals = [i - 1, r['scene'], r['place'], r['file'], r['line'], r['func'], r['text'], r['cond'], r['override'] or r['cond_jp'], r['how'], r['ph'], None, None]
    for j, v in enumerate(vals, 1):
        c = ws.cell(row=i, column=j, value=v)
        c.font = Font(name=F, size=10)
        c.alignment = Alignment(vertical='top', wrap_text=True)
        c.border = border
        if j >= 12:
            c.fill = input_fill
ws.freeze_panes = 'H2'
ws.auto_filter.ref = f'A1:M{len(rows) + 1}'

ws2 = wb.create_sheet('用語')
ws2.append(['内部値・用語', '意味'])
for k, v in [('卵感（egg）', '卵の量・風味。0〜1'), ('乳脂肪（fat）', '生クリームの濃さ。0〜1'), ('気泡（air）', '泡の多さ。0〜1'),
             ('硬さ（firm）', '0〜1。大きいほど硬い'), ('弾力（elastic）', '0〜1。大きいほど押しても戻る'),
             ('す（su）', '加熱した卵の断面の小さな穴。0〜1'), ('離水（syneresis）', '水が出る度合い。0〜1'),
             ('香り（almond など）', 'アーモンド・杏仁・コーヒー・レモン・ヨーグルト・ローズ・ココナッツ・ショウガ・果物。0〜1。0.35超で「香りがある」扱い'),
             ('焦げた膜（crust）', 'クレームブリュレの硬い膜。0.5超で「膜がある」'),
             ('黄色み・つや・茶色・ピンク', '見た目の特徴値。中身から計算される'),
             ('原形（shape）', '0〜100。鑑定で崩れると減る'), ('残量（amount）', '0〜1。すくう・味見・完食で減る'),
             ('揺らぎ±0.07', '境目にある個体は、調べるたびに言い方が変わるようにするための揺れ'),
             ('固め方', '卵の加熱／ゼラチン／寒天／でんぷん／酸（レモン）／酵素（ショウガ）／固まっていない')]:
    ws2.append([k, v])
for c in ws2[1]:
    c.font = Font(name=F, bold=True, color='FFFFFF')
    c.fill = head_fill
for row in ws2.iter_rows(min_row=2):
    for c in row:
        c.font = Font(name=F, size=10)
        c.alignment = Alignment(wrap_text=True, vertical='top')
ws2.column_dimensions['A'].width = 30
ws2.column_dimensions['B'].width = 90

wb.save(OUT)
from collections import Counter
print(len(rows), Counter(r['scene'] for r in rows))
