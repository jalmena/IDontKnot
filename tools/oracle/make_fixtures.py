"""Generate reference diagram fixtures and cross-check them against independent tools.

Run:  python -I make_fixtures.py OUT.json
Needs (development time only, never shipped): snappy, spherogram, regina, knot_floer_homology, database_knotinfo.
Every polynomial stored in the output was computed twice: by the state-sum prototype in kd.py and by Regina.
"""
import json, sys, datetime
from fractions import Fraction
sys.path.insert(0, '.')
from diagram_prototype import to_pd, genus, open_genus, jones, braid, fmt
import snappy, spherogram, regina
from database_knotinfo import link_list

def regina_jones(code):
    p = regina.Link.fromPD(str([[a + 1 for a in t] for t in code])).jones()
    return {Fraction(e, 2): int(str(p[e])) for e in range(p.minExp(), p.maxExp() + 1) if str(p[e]) != '0'}

def normalise(pd):
    cs = sorted(pd, key=str); arcs = sorted({a for t in pd.values() for a in t}); m = {a: i for i, a in enumerate(arcs)}
    return [tuple(m[a] for a in pd[c]) for c in cs]

def closed_checks(strands, signs):
    """strands must describe closed components only. Returns expected-value dict + list of checks performed."""
    pd = to_pd(strands, signs); code = normalise(pd); checks = ['planarity (genus of the combinatorial map)']
    assert genus(pd) == 0
    v = jones(pd, signs); out = {'crossingCount': len(pd), 'writhe': sum(signs[c] for c in pd)}
    if len(pd) >= 2:
        rj = regina_jones(code); assert rj == v, (fmt(rj), fmt(v)); checks.append('Jones polynomial: prototype state sum == Regina')
    out['jones'] = {str(e): c for e, c in sorted(v.items())}
    ncomp = len(strands)
    if ncomp == 1 and len(pd) >= 3:
        L = spherogram.Link(code)
        rl = regina.Link.fromPD(str([[a + 1 for a in t] for t in code])); ap = rl.alexander()
        out['alexander'] = [int(str(ap[i])) for i in range(ap.degree() + 1)]; checks.append('Alexander polynomial: Regina')
        h = L.knot_floer_homology(); out['seifertGenus'] = int(h['seifert_genus']); out['fibered'] = bool(h['fibered']); checks.append('genus and fibredness: knot Floer homology')
    if len(pd) >= 2:
        try:
            L = spherogram.Link(code); E = L.exterior(); names = [str(x).split('(')[0] for x in E.identify()]
            if names:
                out['snappyIdentify'] = names; out['hyperbolicVolume'] = round(float(E.volume()), 9); checks.append('identification of the complement: SnapPy census')
        except Exception as e:
            pass
    return out, checks

def S(seq): return [[str(c), ou] for c, ou in seq]
def named(strands, signs, prefix='c'):
    """Rename integer crossings to c1.. for output."""
    ren = lambda c: c if isinstance(c, str) else f"{prefix}{c}"
    return {k: [(ren(c), ou) for c, ou in v] for k, v in strands.items()}, {ren(c): s for c, s in signs.items()}

kinfo = {r['name']: r for r in link_list()[2:]}
def kbraid(name):
    return [int(x) for x in kinfo[name]['braid_notation'].strip('{}[]()').replace('{','').replace('}','').split(',')]

D = []
def add_closed(id_, title, strands, signs, source, known_as=None, note=None, kind=None):
    strands, signs = named(strands, signs)
    exp, checks = closed_checks(strands, signs)
    exp['componentCount'] = len(strands)
    D.append({'id': id_, 'title': title, 'class': kind or ('classical-knot' if len(strands) == 1 else 'classical-link'),
              'components': [{'id': k, 'kind': 'rope', 'closed': True} for k in strands],
              'crossings': [{'id': c, 'sign': s} for c, s in signs.items()],
              'strands': {k: S(v) for k, v in strands.items()},
              'source': source, **({'knownAs': known_as} if known_as else {}), **({'note': note} if note else {}),
              'expected': exp, 'checks': checks})
    print(f"{id_:28s} n={exp['crossingCount']:2d} w={exp['writhe']:+d} V={fmt(jones(to_pd(strands, signs), signs))}  id={exp.get('snappyIdentify', '-')}")

def add_braid(id_, title, word, n, **kw):
    s, sg = braid(word, n); add_closed(id_, title, s, sg, f"closure of the braid word {word} on {n} strands", **kw)

add_closed('unknot-kink', 'Unknot drawn with one kink', {'k': [(1,'o'),(1,'u')]}, {1: 1}, 'one Reidemeister I move applied to a circle', known_as='0_1 (unknot)')
add_braid('trefoil-right', 'Right-handed trefoil', [1,1,1], 2, known_as='3_1, positive crossings')
add_braid('trefoil-left', 'Left-handed trefoil', [-1,-1,-1], 2, known_as='mirror image of trefoil-right')
add_braid('figure-eight', 'Figure-eight knot', [1,-2,1,-2], 3, known_as='4_1 (amphichiral)')
add_braid('cinquefoil', 'Cinquefoil, the (2,5) torus knot', [1]*5, 2, known_as='5_1')
add_braid('three-twist', 'Three-twist knot', kbraid('5_2'), 3, known_as='5_2')
add_braid('torus-3-4', 'The (3,4) torus knot', [1,2]*4, 3, known_as='8_19, the first non-alternating knot in the tables')
add_braid('knot-10-132', 'Knot 10_132', kbraid('10_132'), max(abs(x) for x in kbraid('10_132')) + 1, known_as='10_132',
          note='Shares its Jones and Alexander polynomials with the cinquefoil (up to mirror image) although the two knots are different: 10_132 is hyperbolic, 5_1 is a torus knot. A test that invariants can fail to separate knots.')
add_braid('granny-closed', 'Granny knot (closed)', [1,1,1,2,2,2], 3, known_as='3_1 # 3_1, connected sum of two trefoils of the same handedness')
add_braid('square-closed', 'Square knot (closed)', [1,1,1,-2,-2,-2], 3, known_as='3_1 # mirror(3_1)',
          note='Same Alexander polynomial as the granny knot; the Jones polynomial and the signature tell them apart.')
add_braid('hopf-positive', 'Hopf link, linking number +1', [1,1], 2, known_as='L2a1')
add_braid('hopf-negative', 'Hopf link, linking number -1', [-1,-1], 2, known_as='L2a1 with one component reversed')
add_braid('whitehead', 'Whitehead link', [1,-2,1,-2,-2], 3, known_as='L5a1', note='Linking number 0, yet the components cannot be separated.')
add_braid('borromean', 'Borromean rings', [1,-2,1,-2,1,-2], 3, known_as='L6a4', note='Every pair of components is unlinked; the three together are not.')

def add_open(id_, title, comps, strands, signs, source, closure_pairs, expected_extra=None, known_as=None, note=None, kind='open-knot'):
    """closure_pairs: how to join ends through the exterior face to get the closed diagram used for verification:
       list of component ids traversed in order, each as (comp, 'fwd'|'rev'); all joins lie in the common end face."""
    closed = {c['id']: c['closed'] for c in comps}
    g, C, ef = open_genus(strands, signs, closed); assert g == 0, id_
    exp = {'planar': True, 'connected': C == 1, 'componentCount': len(strands), 'crossingCount': len(signs),
           'writhe': sum(signs.values()), 'endsShareOneFace': len(set(ef.values())) == 1}
    checks = ['planarity with end vertices (genus of the combinatorial map)', 'all rope ends lie in one face']
    if closure_pairs:
        seq = []; flips = set()
        for comp, direction in closure_pairs['order']:
            v = strands[comp]; seq += v if direction == 'fwd' else list(reversed(v))
            if direction == 'rev': flips.add(comp)
        owner = {}
        for comp, v in strands.items():
            for c, _ in v: owner.setdefault(c, set()).add(comp)
        keep = {c for c, _ in seq}
        seq = [(c, ou) for c, ou in seq if sum(1 for cc, _ in seq if cc == c) == 2]
        cs = {}
        for c in {c for c, _ in seq}:
            nflip = sum(1 for comp in owner[c] if comp in flips) if len(owner[c]) == 2 else 0
            cs[c] = signs[c] * (-1 if nflip == 1 else 1)
        cexp, cchecks = closed_checks({'k': seq}, cs)
        exp['closure'] = {'description': closure_pairs['description'], **cexp}; checks += [f"closure: {x}" for x in cchecks]
    if expected_extra: exp.update(expected_extra)
    D.append({'id': id_, 'title': title, 'class': kind, 'components': comps,
              'crossings': [{'id': c, 'sign': s} for c, s in signs.items()], 'strands': {k: S(v) for k, v in strands.items()},
              'source': source, **({'knownAs': known_as} if known_as else {}), **({'note': note} if note else {}), 'expected': exp, 'checks': checks})
    cl = exp.get('closure', {}); print(f"{id_:28s} n={exp['crossingCount']:2d} ends-in-one-face={exp['endsShareOneFace']} closure V={cl.get('jones')} id={cl.get('snappyIdentify','-')}")

rope = lambda i='rope', a='standing', b='working': {'id': i, 'kind': 'rope', 'closed': False, 'ends': {'start': {'role': a}, 'end': {'role': b}}}
one = {'order': [('rope', 'fwd')], 'description': 'join the two ends by an arc through their common face'}
st, sg = named({'rope': [(1,'o'),(2,'u'),(3,'o'),(1,'u'),(2,'o'),(3,'u')]}, {1:1,2:1,3:1})
add_open('overhand-knot', 'Overhand knot in an open rope', [rope()], st, sg, 'hand-derived; signs fixed by planarity', one, known_as='ABOK #46; closes to the trefoil')
st, sg = named({'rope': [(1,'o'),(2,'u'),(3,'o'),(4,'u'),(2,'o'),(1,'u'),(4,'o'),(3,'u')]}, {1:1,2:1,3:-1,4:-1})
add_open('figure-eight-stopper', 'Figure-eight knot in an open rope', [rope()], st, sg, 'hand-derived; signs fixed by planarity', one, known_as='ABOK #520; closes to 4_1')
st, sg = named({'rope': [(1,'o'),(2,'u'),(5,'u'),(4,'o'),(3,'o'),(1,'u'),(2,'o'),(3,'u'),(4,'u'),(5,'o')]}, {1:1,2:1,3:1,4:-1,5:-1})
add_open('slipped-overhand', 'Slipped overhand knot (a bight tucked instead of the end)', [rope()], st, sg, 'hand-derived from the overhand knot by replacing the final tuck with a bight', one,
         note='Topologically trivial with the ends held: its closure is the unknot. It is nevertheless a distinct, useful knot. Identity of practical knots cannot rest on topology alone.')
two = {'order': [('a', 'fwd'), ('b', 'rev')], 'description': "join a.end to b.end and b.start to a.start through the common face (standing part to standing part, tail to tail)"}
A = [(1,'o'),(2,'u'),(3,'o'),(4,'o'),(5,'u'),(6,'o')]; B = [(3,'u'),(2,'o'),(1,'u'),(6,'u'),(5,'o'),(4,'u')]
st, sg = named({'a': A, 'b': B}, {1:1,2:1,3:1,4:-1,5:-1,6:-1})
add_open('reef-knot', 'Reef knot joining two ropes', [rope('a', 'standing', 'working'), rope('b', 'standing', 'working')], st, sg,
         'two columns of three half-twists of opposite handedness (tangle 1/3 + 1/-3)', two, kind='bend', known_as='ABOK #1402; closes to the square knot')
add_open('thief-knot', 'Thief knot: the reef knot diagram with the loaded ends on opposite sides', [rope('a', 'standing', 'working'), rope('b', 'working', 'standing')], st, sg,
         'same diagram as reef-knot; only the end roles of rope b are exchanged', None, kind='bend', known_as='ABOK #1207',
         note='Identical crossing structure to the reef knot. Only the roles of the ends differ, so end roles are part of what a practical knot is.')
A = [(1,'o'),(2,'u'),(3,'o'),(4,'u'),(5,'o'),(6,'u')]; B = [(3,'u'),(2,'o'),(1,'u'),(6,'o'),(5,'u'),(4,'o')]
st, sg = named({'a': A, 'b': B}, {c: 1 for c in range(1, 7)})
add_open('granny-knot', 'Granny knot joining two ropes', [rope('a'), rope('b')], st, sg, 'two columns of three half-twists of the same handedness (tangle 1/3 + 1/3)', two, kind='bend', known_as='ABOK #1405; closes to the granny knot')
R = [('d1','u'),('p1','o'),('p2','u'),('d1','o'),('p3','o'),('d2','o'),('p4','u'),('p5','o'),('d2','u')]
P = [('p2','o'),('p1','u'),('p3','u'),('p5','u'),('p4','o')]
sg = {'d1':-1,'p1':1,'p2':1,'p3':1,'d2':-1,'p4':1,'p5':1}
rope_alone = [(c, ou) for c, ou in R if c.startswith('d')]
ra, _ = closed_checks({'k': rope_alone}, {'d1': -1, 'd2': -1})
add_open('clove-hitch-on-pole', 'Clove hitch on a pole', [rope(), {'id': 'pole', 'kind': 'rigid', 'shape': 'pole', 'closed': False, 'ends': {'start': {'role': 'blocked'}, 'end': {'role': 'blocked'}}}],
         {'rope': R, 'pole': P}, sg, 'hand-derived from an explicit planar layout; signs computed from the tangent directions', None, kind='hitch', known_as='ABOK #1245',
         expected_extra={'ropeObjectCrossingSignSum': {'rope|pole': sum(v for k, v in sg.items() if k.startswith('p'))},
                         'ropeAloneClosureJones': ra['jones']},
         note='Delete the pole and the rope has only two removable kinks: the hitch has no existence without its object. Objects must be part of the topological description.')

out = {'format': 'idk-reference-diagrams', 'formatVersion': '0.1.0',
       'generated': {'date': datetime.date.today().isoformat(),
                     'tools': {'snappy': snappy.__version__, 'spherogram': spherogram.__version__, 'regina': regina.__version__ if hasattr(regina, '__version__') else str(regina.versionString()), 'database_knotinfo': 'braid words for 5_2 and 10_132 only'}},
       'conventions': {'view': 'the diagram is seen from +z; "o" (over) is nearer the viewer',
                       'crossingSign': 'sign of (tangent_over x tangent_under) . z; +1 is the right-handed crossing',
                       'strands': 'each component lists its crossing visits in order of travel; closed components are cyclic',
                       'jones': 'V(t) keyed by exponent of t; the right-handed trefoil has V = t + t^3 - t^4',
                       'alexander': 'coefficients from degree 0 upward, normalised to a polynomial with positive constant term'},
       'diagrams': D}
json.dump(out, open(sys.argv[1], 'w'), indent=2); print(len(D), 'diagrams written')
