#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify_text.py —— 正文校勘校验

作用:从 posts/ 下的文章页中提取正文,与权威参照文本逐字比对,
      并核对页面标注的字数。用于防止日后编辑时误增、误删、误改一字。

用法:
    python3 docs/verify_text.py

退出码:0 全部通过;1 存在差异(会打印具体分歧位置)。
"""

import difflib
import os
import re
import sys
import html

# ---------------------------------------------------------------------------
# 权威参照文本
# 说明:以下两篇均经多源交叉核对,并与页面正文逐字比对通过。
#   前赤壁赋 —— 与维基文库《前赤壁赋》净正文逐字一致(仅「共适/共食」异文,详篇末校勘记)
#   后赤壁赋 —— 同时与识典古籍《东坡全集》本、维基文库本逐字一致
# 此处为校勘基准,请勿随意改动;若确需更改,须同步更新篇末版本说明。
# ---------------------------------------------------------------------------
REFERENCE = {
    "posts/qian-chibi-fu.html": (
        "前赤壁赋", 537,
        "壬戌之秋，七月既望，苏子与客泛舟游于赤壁之下。清风徐来，水波不兴。举酒属客，"
        "诵明月之诗，歌窈窕之章。少焉，月出于东山之上，徘徊于斗牛之间。白露横江，水光接天。"
        "纵一苇之所如，凌万顷之茫然。浩浩乎如冯虚御风，而不知其所止；飘飘乎如遗世独立，"
        "羽化而登仙。于是饮酒乐甚，扣舷而歌之。歌曰：桂棹兮兰桨，击空明兮溯流光。"
        "渺渺兮予怀，望美人兮天一方。客有吹洞箫者，倚歌而和之。其声呜呜然，如怨如慕，"
        "如泣如诉，余音袅袅，不绝如缕。舞幽壑之潜蛟，泣孤舟之嫠妇。苏子愀然，"
        "正襟危坐而问客曰：何为其然也？客曰：月明星稀，乌鹊南飞，此非曹孟德之诗乎？"
        "西望夏口，东望武昌，山川相缪，郁乎苍苍，此非孟德之困于周郎者乎？方其破荆州，"
        "下江陵，顺流而东也，舳舻千里，旌旗蔽空，酾酒临江，横槊赋诗，固一世之雄也，"
        "而今安在哉？况吾与子渔樵于江渚之上，侣鱼虾而友麋鹿，驾一叶之扁舟，举匏樽以相属。"
        "寄蜉蝣于天地，渺沧海之一粟。哀吾生之须臾，羡长江之无穷。挟飞仙以遨游，"
        "抱明月而长终。知不可乎骤得，托遗响于悲风。苏子曰：客亦知夫水与月乎？"
        "逝者如斯，而未尝往也；盈虚者如彼，而卒莫消长也。盖将自其变者而观之，"
        "则天地曾不能以一瞬；自其不变者而观之，则物与我皆无尽也，而又何羡乎？"
        "且夫天地之间，物各有主，苟非吾之所有，虽一毫而莫取。惟江上之清风，与山间之明月，"
        "耳得之而为声，目遇之而成色，取之无禁，用之不竭，是造物者之无尽藏也，"
        "而吾与子之所共适。客喜而笑，洗盏更酌。肴核既尽，杯盘狼籍。相与枕藉乎舟中，"
        "不知东方之既白。"
    ),
    "posts/hou-chibi-fu.html": (
        "后赤壁赋", 357,
        "是岁十月之望，步自雪堂，将归于临皋。二客从予，过黄泥之坂。霜露既降，木叶尽脱。"
        "人影在地，仰见明月。顾而乐之，行歌相答。已而叹曰：有客无酒，有酒无肴，月白风清，"
        "如此良夜何？客曰：今者薄暮，举网得鱼，巨口细鳞，状如松江之鲈。顾安所得酒乎？"
        "归而谋诸妇。妇曰：我有斗酒，藏之久矣，以待子不时之须。于是携酒与鱼，"
        "复游于赤壁之下。江流有声，断岸千尺；山高月小，水落石出。曾日月之几何，"
        "而江山不可复识矣！予乃摄衣而上，履巉岩，披蒙茸，踞虎豹，登虬龙，攀栖鹘之危巢，"
        "俯冯夷之幽宫。盖二客不能从焉。划然长啸，草木震动，山鸣谷应，风起水涌。"
        "予亦悄然而悲，肃然而恐，凛乎其不可留也。反而登舟，放乎中流，听其所止而休焉。"
        "时夜将半，四顾寂寥。适有孤鹤，横江东来，翅如车轮，玄裳缟衣，戛然长鸣，"
        "掠予舟而西也。须臾客去，予亦就睡。梦一道士，羽衣翩跹，过临皋之下，揖予而言曰："
        "赤壁之游乐乎？问其姓名，俯而不答。呜呼噫嘻！我知之矣！畴昔之夜，飞鸣而过我者，"
        "非子也耶？道士顾笑，予亦惊悟。开户视之，不见其处。"
    ),
}

# 页面上「五百三十七字」这类中文数字标注
CN_DIGITS = {
    "零": 0, "一": 1, "二": 2, "三": 3, "四": 4,
    "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
}


def han_only(text):
    """只保留汉字,剔除标点、空白、拉丁字母等一切非汉字字符。"""
    return "".join(ch for ch in text if "\u4e00" <= ch <= "\u9fff")


def cn_to_int(s):
    """把「五百三十七」这类中文数字转成 int。"""
    if not s:
        return None
    total, section, number = 0, 0, 0
    for ch in s:
        if ch in CN_DIGITS:
            number = CN_DIGITS[ch]
        elif ch == "十":
            section += (number or 1) * 10
            number = 0
        elif ch == "百":
            section += (number or 1) * 100
            number = 0
        elif ch == "千":
            section += (number or 1) * 1000
            number = 0
        else:
            return None
    return total + section + number


def extract_body(path):
    """从文章页里取出 <div class="essay__body"> 内的全部文字。"""
    with open(path, encoding="utf-8") as fh:
        source = fh.read()
    match = re.search(r'<div class="essay__body">(.*?)</div>', source, re.S)
    if not match:
        raise SystemExit(f"✗ {path}: 找不到 essay__body 容器")
    return html.unescape(re.sub(r"<[^>]+>", "", match.group(1)))


def extract_declared_count(path):
    """读取页面标题区标注的字数,如 <span>五百三十七字</span>。"""
    with open(path, encoding="utf-8") as fh:
        source = fh.read()
    match = re.search(
        r"<span>([零一二三四五六七八九十百千]+)字</span>", source
    )
    return cn_to_int(match.group(1)) if match else None


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)

    failures = 0
    for path, (title, expected, reference) in REFERENCE.items():
        print(f"=== 《{title}》 ===")
        if not os.path.exists(path):
            print(f"  ✗ 文件不存在: {path}\n")
            failures += 1
            continue

        page = han_only(extract_body(path))
        ref = han_only(reference)

        print(f"  页面正文 {len(page)} 字 / 校勘基准 {len(ref)} 字 / 应为 {expected} 字")

        if page == ref:
            if len(page) == expected:
                print("  ✅ 逐字一致,字数相符")
            else:
                print(f"  ⚠️ 逐字一致,但与标注的 {expected} 字不符")
                failures += 1
        else:
            # 用序列比对定位增、删、改,避免一处改动引发后续全部错位误报
            print("  ❌ 与校勘基准存在差异:")
            changes = 0
            for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(
                None, page, ref, autojunk=False
            ).get_opcodes():
                if tag == "equal":
                    continue
                changes += 1
                if changes > 20:
                    continue
                context = page[max(0, i1 - 6):i1]
                if tag == "replace":
                    print(f"       第 {i1 + 1} 字起: 页面「{page[i1:i2]}」"
                          f" 应为「{ref[j1:j2]}」   语境: ...{context}[此处]...")
                elif tag == "delete":
                    print(f"       第 {i1 + 1} 字起: 页面多出「{page[i1:i2]}」"
                          f"   语境: ...{context}[此处]...")
                else:  # insert
                    print(f"       第 {i1 + 1} 字处: 页面缺「{ref[j1:j2]}」"
                          f"   语境: ...{context}[此处]...")
            if changes > 20:
                print(f"       ...另有 {changes - 20} 处差异未列出")
            failures += 1

        declared = extract_declared_count(path)
        if declared is None:
            print("  ⚠️ 页面未标注字数")
        elif declared != len(page):
            print(f"  ❌ 页面标注 {declared} 字,实际 {len(page)} 字")
            failures += 1
        else:
            print(f"  ✅ 页面标注字数正确({declared} 字)")

        print()

    if failures:
        print(f"校勘未通过:共 {failures} 项问题")
        return 1
    print("校勘通过:所有篇目正文与校勘基准逐字一致,字数标注正确。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
