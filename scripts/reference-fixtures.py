"""Independent exact translations of identified workbook formulas, not VBA execution."""
from fractions import Fraction as F
from pathlib import Path
import json

def results(raw):
    return [F(4)-(1+sum(v>x for v in raw)+F(sum(v==x for v in raw)-1,2))+F(x,100) for x in raw]
def fixture(n):
    players=list(range(1,n+1));games=[players[i:i+4] for i in range(0,n,4)]
    scores=[[1200-50*j-90*i if j!=2 else 800-90*i for j in range(4)] for i in range(n//4)]
    totals={p:F(0) for p in players};rounds=[]
    def add(gs,ss):
        for g,s in zip(gs,ss):
            for p,points in zip(g,results(s)):totals[p]+=points
        rounds.append(gs)
    def pair():
        available=players[:];out=[]
        adj=lambda p:totals[p]-F(p,1000000)
        def dist(a,b):return abs(adj(a)-adj(b))+sum((i+1)*1000 for i,r in enumerate(rounds) if any(a in g and b in g for g in r))
        while available:
            leader=max(available,key=adj);available.remove(leader);g=[leader]
            while len(g)<4:
                p=min(available,key=lambda p:(sum(dist(p,q) for q in g),p));g.append(p);available.remove(p)
            out.append(g)
        return out
    add(games,scores);second=pair()
    second_scores=[[1000-80*i,750-50*i,750-50*i,-100+20*i] for i in range(n//4)]
    add(second,second_scores);third=pair()
    return {'participants':n,'round1':games,'round1Scores':scores,'expectedRound2':second,'round2Scores':second_scores,'expectedRound3':third,'totalPointUnitsAfter2':[int(totals[p]*10000) for p in players]}
path=Path(__file__).parents[1]/'tests/workbook-fixtures.json'
path.write_text(json.dumps({'provenance':'Independent Fraction evaluation of Сортировка D/H, Распределение B:AO, CH/EA/FT and Бои C2:C5; Excel not executed.','scenarios':[fixture(12),fixture(16),fixture(24)]},ensure_ascii=False,indent=2)+'\n')
