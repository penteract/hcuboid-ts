import * as hcs from "./hcuboid.js";
import {HC,AxisLoc,LIndex,Point,Slice,Graph} from "./hcuboid.js";


var hh=hcs
console.log("starting tests")
function eq(a,b){
  let x = eval (a)
  if(JSON.stringify(x)!=JSON.stringify(b)){
    console.log("expected `"+a+"` to evaluate to ",b,"\n  but received ",x)
    return false
  }
  return true
}

// confirm that 2 arrays contain the same set of elements
function sameEls(a,b){
  let differ=false
  let i = 0
  let bs = b.map(x=>JSON.stringify(x)).sort()
  for(let x of a.map(x=>JSON.stringify(x)).sort()){
    while(i<bs.length && bs[i]<x){
      differ=true
      console.log("element `"+bs[i]+"` in b but not a")
      i++
    }
    if(i>=b.length || bs[i]!=x){
      differ=true
      console.log("element `"+x+"` in a but not b")
    }
    else{
      i++
    }
  }
  while(i<bs.length){
    differ=true
    console.log("element `"+bs[i]+"` in b but not a")
    i++
  }
  return !differ
}

eq("hcs.lt([3,4,5,6])",[3,4])



function listPoints(hc:HC):Point[]{
  let res = []
  let tls = Object.keys(hc)
  let stack = [Object.keys(hc[tls[0]])]
  let partial={}
  while (stack.length){
    let cur = stack[stack.length-1]
    let l = tls[stack.length-1]
    if(cur.length){
      let ix = cur.pop()
      partial[l] = [ix,hc[l][ix]]
      if (tls.length>stack.length)
        stack.push(Object.keys(hc[tls[stack.length]]))
      else
        res.push(Object.assign({},partial))
    }
    else stack.pop()
  }
  return res
}

function toHC(hc:HC, slice:Slice):HC{
  let altSlice:HC = {} // will describe the subset of slice that intersects hc
  for(let l in hc){
    if(l in slice){
      altSlice[l] = {}
      for(let n of slice[l]){
        if(n in hc[l]) altSlice[l][n] = hc[l][n]
      }
    }
    else altSlice[l]=hc[l]
  }
  return altSlice
}

function eqPt(x,y){
  return Object.entries(x).every(([l,loc])=>y[l][0]==loc[0])
}

// Set up a test hypercuboid
let testhc : HC = {}
let testLocs : AxisLoc[] = []
for (let i=0;i<3;i++){
  testLocs.push({type:"pass",lt:[i,7-i]})
}
for (let l of [1,0,-1]){
  testhc[l]=testLocs
}

//This one's to check that the testing code works
eq("listPoints(testhc).length",27)
// Check that removePoint works
for (let pt of listPoints(testhc)){
  if(!eq("hcs.removePoint(testhc,"+JSON.stringify(pt)+")"
           +".flatMap(listPoints).length",26))
        break;
  if(!sameEls(hcs.removePoint(testhc,pt).flatMap(x=>listPoints(x))
         ,listPoints(testhc).filter(x=>!eqPt(x,pt))))
      break;
}

let testSlice = {0:[1] ,1:[0,1]}
//again, check that the testing code works
eq("listPoints(toHC(testhc,testSlice)).length",6)
//check that removeSlice works
eq("hcs.removeSlice(testhc,testSlice).flatMap(listPoints).length"
  , listPoints(testhc).length - listPoints(toHC(testhc,testSlice)).length)
sameEls(hcs.removeSlice(testhc,testSlice).flatMap(listPoints)
         , listPoints(testhc).filter(x=>listPoints(toHC(testhc,testSlice)).every(y=>!eqPt(x,y))))
/*for (let p of hcs.removeSlice(testhc,testSlice).flatMap(listPoints))
  console.log(p)*/


// test matching
let g:Graph<string,[number,number]> = {}

for (let i=0;i<3;i++){
  g["n"+i]={}
  for (let j=0;j<3;j++)if(j!=i){
    g["n"+i]["n"+j]=[i,j]
  }
}


eq("Object.values(hcs.findMatching(g,[])).length",0)
eq("Object.values(hcs.findMatching(g,['n1'])).length",2)
sameEls(Object.values(hcs.findMatching(g,['n0','n2'])),[[0,2],[2,0]])
eq("hcs.findMatching(g,['n0','n1','n2'])",null)
eq("hcs.findMatching(g,['n2','n1','n0'])",null)
eq("hcs.findMatching(g,['n1','n2','n0'])",null)
eq("hcs.findMatching(g,['n1','n0','n2'])",null)

//console.log(Object.values(hcs.takePoint(testhc)))