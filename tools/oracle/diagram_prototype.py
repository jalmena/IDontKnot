"""Scratch prototype: signed Gauss ("strand visit") diagrams -> PD, planarity, Kauffman bracket/Jones.
Conventions (to be fixed in the spec):
  * viewer looks down -z; "over" is nearer the viewer.
  * crossing sign = sign((t_over x t_under) . z); +1 is the right-handed crossing.
  * PD tuple = arcs counter-clockwise starting at the incoming under arc.
  * Kauffman bracket: A-smoothing joins (a,b),(c,d) of PD [a,b,c,d]; V(t) = (-A^3)^(-w) <D> at A = t^(-1/4).
"""
from fractions import Fraction
from itertools import product
from collections import defaultdict

def to_pd(strands, signs):
    """strands: {comp: [(crossing, 'o'|'u'), ...]} all treated as closed. Returns (pd, arc_owner)."""
    arc_id = {}; n = 0
    for comp, visits in strands.items():
        for j in range(len(visits)):
            arc_id[(comp, j)] = n; n += 1          # arc j runs from visit j to visit j+1 (cyclic)
    where = defaultdict(dict)
    for comp, visits in strands.items():
        k = len(visits)
        for j, (c, ou) in enumerate(visits):
            assert ou not in where[c], f"crossing {c} visited twice as {ou}"
            where[c][ou] = (arc_id[(comp, (j - 1) % k)], arc_id[(comp, j)])   # (in, out)
    pd = {}
    for c, w in where.items():
        assert set(w) == {'o', 'u'}, f"crossing {c} incomplete"
        (ui, uo), (oi, oo) = w['u'], w['o']
        pd[c] = (ui, oo, uo, oi) if signs[c] > 0 else (ui, oi, uo, oo)
    return pd

def genus(pd):
    """Genus of the surface the 4-valent map embeds in (0 == classical/planar). Assumes connected."""
    ends = defaultdict(list)
    for c, t in pd.items():
        for s, a in enumerate(t): ends[a].append((c, s))
    alpha = {}
    for a, (d1, d2) in ends.items(): alpha[d1] = d2; alpha[d2] = d1
    seen = set(); faces = 0
    for d in alpha:
        if d in seen: continue
        faces += 1; x = d
        while x not in seen:
            seen.add(x); c, s = alpha[x]; x = (c, (s + 1) % 4)
    V = len(pd); E = 2 * V
    return (2 - V + E - faces) // 2

def padd(p, q):
    r = defaultdict(int)
    for k, v in p.items(): r[k] += v
    for k, v in q.items(): r[k] += v
    return {k: v for k, v in r.items() if v}

def pmul(p, q):
    r = defaultdict(int)
    for k1, v1 in p.items():
        for k2, v2 in q.items(): r[k1 + k2] += v1 * v2
    return {k: v for k, v in r.items() if v}

def bracket(pd):
    cs = list(pd); d = {2: -1, -2: -1}; total = {}
    for state in product((0, 1), repeat=len(cs)):
        parent = {}
        def find(x):
            parent.setdefault(x, x)
            while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
            return x
        for c, s in zip(cs, state):
            a, b, cc, dd = pd[c]
            pairs = ((a, b), (cc, dd)) if s == 0 else ((b, cc), (dd, a))
            for x, y in pairs: parent[find(x)] = find(y)
        loops = len({find(x) for t in pd.values() for x in t})
        term = {len(cs) - 2 * sum(state): 1}
        for _ in range(loops - 1): term = pmul(term, d)
        total = padd(total, term)
    return total

def jones(pd, signs):
    w = sum(signs[c] for c in pd)
    f = pmul(bracket(pd), {-3 * w: (-1) ** (w % 2)})          # (-A^3)^(-w)
    return {Fraction(-k, 4): v for k, v in sorted(f.items())}   # A = t^(-1/4)

def fmt(p):
    out = []
    for e in sorted(p):
        es = str(e.numerator) if e.denominator == 1 else f"({e})"
        out.append(f"{p[e]:+d}t^{es}")
    return " ".join(out) if out else "0"

def braid(word, n):
    """Closed braid, strands oriented upward, sigma_i>0: strand at position i passes over to i+1 (positive crossing)."""
    pos_strand = list(range(n)); visits = [[] for _ in range(n)]; signs = {}
    for k, g in enumerate(word, 1):
        i = abs(g) - 1; a, b = pos_strand[i], pos_strand[i + 1]
        signs[k] = 1 if g > 0 else -1
        visits[a].append((k, 'o' if g > 0 else 'u')); visits[b].append((k, 'u' if g > 0 else 'o'))
        pos_strand[i], pos_strand[i + 1] = b, a
    perm = {s: p for p, s in enumerate(pos_strand)}             # strand s (started at bottom s) ends at top perm[s]
    comps = {}; done = set()
    for s in range(n):
        if s in done: continue
        seq = []; x = s
        while x not in done: done.add(x); seq += visits[x]; x = perm[x]
        comps[f"k{len(comps)}"] = seq
    return comps, signs

def planar_signings(strands):
    cs = sorted({c for v in strands.values() for c, _ in v})
    for combo in product((1, -1), repeat=len(cs)):
        signs = dict(zip(cs, combo))
        if genus(to_pd(strands, signs)) == 0: yield signs

def open_genus(strands, signs, closed):
    """Genus and face structure of a diagram whose components may be open (degree-1 end vertices).
    Returns (genus, n_connected, end_faces) where end_faces maps (comp, 'start'|'end') -> face index."""
    alpha = {}; sigma = {}; vert_of = {}; slot = defaultdict(dict)
    ends = {}
    for comp, visits in strands.items():
        k = len(visits)
        if closed[comp]:
            arcs = [((comp, (j - 1) % k), (comp, j)) for j in range(k)]   # arc j-1 arrives at visit j ... handled below
        for j, (c, ou) in enumerate(visits):
            # arc arriving at visit j is named (comp, j); arc leaving is (comp, j+1) (cyclic if closed)
            arr = (comp, j); lea = (comp, (j + 1) % k if closed[comp] else j + 1)
            slot[c][ou + '_in'] = (arr, 'head'); slot[c][ou + '_out'] = (lea, 'tail')
        if not closed[comp]:
            ends[(comp, 'start')] = ((comp, 0), 'tail'); ends[(comp, 'end')] = ((comp, k), 'head')
    for c, s in slot.items():
        order = [s['u_in'], s['o_out'], s['u_out'], s['o_in']] if signs[c] > 0 else [s['u_in'], s['o_in'], s['u_out'], s['o_out']]
        for i, d in enumerate(order): sigma[d] = order[(i + 1) % 4]; vert_of[d] = ('x', c)
    for key, d in ends.items(): sigma[d] = d; vert_of[d] = ('e', key)
    for (arc, side) in list(sigma): alpha[(arc, side)] = (arc, 'head' if side == 'tail' else 'tail')
    assert all(alpha[d] in sigma for d in sigma), "dangling arc"
    face_of = {}; nf = 0
    for d in sigma:
        if d in face_of: continue
        x = d
        while x not in face_of: face_of[x] = nf; x = sigma[alpha[x]]
        nf += 1
    parent = {}
    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
        return x
    for d in sigma: parent[find(vert_of[d])] = find(vert_of[alpha[d]])
    C = len({find(v) for v in vert_of.values()})
    V = len(set(vert_of.values())); E = len(sigma) // 2
    g2 = 2 * C - (V - E + nf)
    assert g2 % 2 == 0
    return g2 // 2, C, {k: face_of[d] for k, d in ends.items()}

def planar_open_signings(strands, closed):
    cs = sorted({c for v in strands.values() for c, _ in v})
    for combo in product((1, -1), repeat=len(cs)):
        signs = dict(zip(cs, combo))
        g, C, ef = open_genus(strands, signs, closed)
        if g == 0: yield signs, ef
