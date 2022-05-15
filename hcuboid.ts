import {GameState, Move, Coords, Board2D
  , applyMoves, getCheckPath
  , getPlayableTimelines
  , movesFrom
  , getEndT
  , getNewL
  , getOpL
  , getEnd, getStart, getNewBoards
  , posExists, getFrom2D, getFromState} from "./imports.js";


const TSp = 1; // timeline spacing
export type LIndex = number

export type HC = Record<LIndex,Record<number,AxisLoc>>
export type Point = Record<LIndex,[number,AxisLoc]>

/*The pieces we want to remove have the shape of slices. By "slice", we mean a
subhypercuboid defined by a list of axes and subsets of each axis in the list.
For axes not mentioned, the whole axis is implied.*/
export type Slice = Record<LIndex,number[]>

type Arrive = {
   type:"arrive"
  ,move:Move
  ,board:Board2D
  ,idx:number // index of corresponding leave within axis
}
export type AxisLoc = {
  type:"physical",
  move:Move,
  board:Board2D
} | Arrive | {
  type:"leave",
  source:Coords,
  board:Board2D
} | {
  type:"pass",
  lt:[number,number]|null
}

export function* search(state : GameState) : Iterable<Move[]> {
  let [wholeHC,hcs] = buildHCs(state)
  let sgn = getNewL(state)>0?1:-1
  while(hcs.length){
    let hc = hcs.pop()
    let p = takePoint(hc)
    if (p){
      let problem = findProblem(state,p,wholeHC)
      if(problem){
        hcs.push(...removeSlice(hc,problem))
      }
      else{
        yield toAction(p,sgn)
        hcs.push(...removePoint(hc,p))
      }
    }
  }
}
export function toAction(p:Record<LIndex,[number,AxisLoc]>,sgn:number): Move[] {
  let ls : LIndex[] = Object.keys(p) as any[] as number[] // yes, they're still strings, but it works
  ls.sort((a,b) => a*sgn - b*sgn) // put new timelines at the end (this means that branches are created in the right order)
  let res = []
  for (let l of ls){
    ;let [n,loc] = p[l]
    if(loc.type=="physical" || loc.type=="arrive"){
      res.push(loc.move)
    }
  }
  return res
}

export function buildHCs(state : GameState) : [HC, HC[]] {
  let nonBranches : Record<number,AxisLoc[]> = {}
  let arrivals : AxisLoc[] = [{type:"pass",lt:null}]
  for (let l of getPlayableTimelines(state)){
    nonBranches[l]=[{type:"pass",lt:[l,getEndT(state,l)]}]
  }
  for (let l of getPlayableTimelines(state)){
    let lastLeave = undefined
    let lastLeaveIdx = undefined
    for( let mv of movesFrom(state,l)){
      // Assume that movesFrom returns moves by each piece in turn
      let s = getStart(mv)
      let e = getEnd(mv)
      let nbs = getNewBoards(mv)
      if(lt(e)==lt(s)){
        nonBranches[l].push({type:"physical",move:mv,board:nbs[s[0]]})
        continue;
      }
      if (s!=lastLeave){
        nonBranches[l].push({type:"leave",source:s,board:nbs[s[0]]})
        lastLeaveIdx = nonBranches[l].length-1
      }
      arrivals.push(
        {type:"arrive",move:mv,board:nbs[e[0]],idx:lastLeaveIdx}
      )
      if(nonBranches[e[0]] && getEndT(state,l)==e[1] ){ // isPlayable(state,lt(e))){
        nonBranches[e[0]].push(arrivals[arrivals.length-1])
      }
    }
  }
  let maxBranches=0
  for (let l in nonBranches)
    for (let loc of nonBranches[l])
      if (loc.type=="leave"){
        maxBranches+=1
        break;
      }
  let axes = nonBranches
  let newL = getNewL(state)
  let hcs = []
  // We now split into maxBranches+1 hypercuboids to ensure that
  // we don't consider actions where there is an uncreated timeline closer to
  // the center than some created timeline
  //
  // alternative: split into ceil((maxBranches+1)/2) hcs where some of the axes have both moves and passes
  //TODO: confirm that sharing references doesn't break things
  //(there may be parts that could be sped up by not sharing references)
  let newArrs = arrivals.slice(1)
  for(let numActive=maxBranches;numActive>=0;numActive--){
    let l = newL
    let cur = Object.assign({},axes)
    for(let i=0; i<maxBranches; i++){
      axes[l] = (i>=numActive)?[arrivals[0]]:newArrs;
      l += newL>0?1:-1
    }
    hcs.push(cur)
  }
  let l = newL
  for(let i=0;i<maxBranches;i++){
    axes[l] = arrivals;
    l+=newL>0?TSp:-TSp
  }
  return [axes,hcs]
}

/*
export type HC = Record<LIndex,Record<number,AxisLoc>>
export type Point = Record<LIndex,[number,AxisLoc]>
export type Slice = Record<LIndex,number[]>*/


// The meat of the search - where we find why there is a problem
//  (e.g. why an action results in check)
export function findProblem(state:GameState, p:Point, hc:HC):Slice|null{
  return jumpOrderConsistent(state,p,hc) || testPresent(state,p,hc) || findChecks(state,p,hc)
}

export function jumpOrderConsistent(state:GameState, p:Point, hc:HC):Slice|null{
  return null
}
export function testPresent(state:GameState, p:Point, hc:HC):Slice|null{ // Assumes that T is numbered by half-turn
  const newL = getNewL(state)
  const sgn = newL>0?1:-1

  // the L-index of the timeline most recently created by the opponent
  const minL = getOpL(state)
  // the L-index timeline most recently created by the player
  const maxL = sgn*Math.max(sgn*(newL-sgn*TSp), ...Object.keys(p).filter(k=>p[k][1].type!="pass").map(l=>+l*sgn))
  const active = Math.min(Math.abs(minL),Math.abs(maxL))+TSp
  let minT = Infinity
  let minTl = undefined
  for (let l = sgn*Math.max(sgn*minL,-active); sgn*l < Math.min(sgn*maxL,active); l+=sgn*TSp) {
    let t = getEndT(state, l)
    if (l in p && p[l][1].type!="pass"){
      t+=1
    }
    if (t<minT){
      minT = t
      minTl = l
    }
  }
  if (minTl in p && p[minTl][1].type=="pass"){
    if (minTl*sgn>=newL*sgn) throw "The definition of maxl should exclude minTl being a pass and a new branch"
    // return a slice saying that minTl can't be pass if it is active and
    let result = {}
    result[minTl] = [p[minTl][0]]
    // only remove points where minTl is active
    if ( minTl*sgn < -newL*sgn ){
      // minTl
      let nonPassL = -minTl-sgn*TSp
      result[nonPassL] = Object.keys(hc[nonPassL]).filter(ix => ix!="pass")
    }
    // Only remove points where there isn't an active branch further back
    for (let l = newL; sgn*l < Math.abs(minL)+TSp; l+=sgn*TSp) {
      if(!(l in hc)) break;
      if (!(l in result)) result[l]=Object.keys(hc[l])
      result[l]=result[l].filter((ix:number) => doesNotMoveT(hc[l][ix], minT ))
    }
    return result
  }
  return null
}
function doesNotMoveT(loc:AxisLoc,minT:number){
  return loc.type=="pass" || getLTFromLoc(loc)[1]>=minT;
}
export function findChecks(state:GameState, p:Point, hc:HC):Slice|null{
  //We could use a bit of mutability here and undo before returning
  //let check = withMoves(state, toAction(p,getNewL(state)>0?1:-1) ,getCheckPath)
  let changedState = applyPoint(state,p)
  let check = getCheckPath(changedState)
  if(check){
    let result : Slice = {}
    for(let pos of check){ // We rely on the fact that any path crosses each timeline at most once
      if(!posExists(state,pos)){// The position is added by some newly created board
        let piece = getFromState(changedState,pos) // get the piece or space involved in the check
        result[pos[0]]=[]
        let row = hc[pos[0]]
        for (let ix in row){
          let loc = row[ix]
          if(loc.type!="pass")
            if (getFrom2D(loc.board, [pos[2],pos[3]])==piece)
              result[pos[0]].push(+ix);
        }
      }
    }
  }
  else return null;
}
export function applyPoint(state:GameState, p:Point) : GameState{
  let sgn = getNewL(state)>0?1:-1
  return applyMoves(state, toAction(p,sgn))
}

export function takePoint(hc:HC):Record<LIndex,[number,AxisLoc]> | null{
  let sameboard : Record<LIndex,[number,AxisLoc]> = {}
  let graph : Graph<LIndex,[number,AxisLoc]> = {}
  let mustInclude = []
  for(let l in hc){
    graph[l]={}
    for(let ix in hc[l]){
      let loc = hc[l][ix]
      if (loc.type == "physical" || loc.type=="pass"){
        sameboard[l]=[+ix,loc]
        break;
      }
    }
    if(!sameboard[l]) mustInclude.push(l)
  }
  for(let l in hc){
    for(let ix in hc[l]){
      let loc = hc[l][ix]
      if (loc.type=="arrive"){
        let srcL = getStart(loc.move)[0]
        if(!graph[l][srcL]){
          graph[l][srcL]=[+ix,loc]
          graph[srcL][l]=[loc.idx,hc[srcL][loc.idx]]
          // this assumes that the corresponding leave is actually part of the hypercuboid
        }
      }
    }
  }
  let matching = findMatching(graph,mustInclude)
  if(matching ===null) return null
  return Object.assign(sameboard,matching)
}

//Split a hypercuboid into pieces with a slice removed
export function removeSlice(hc:HC, slice:Slice):HC[]{
  //  to understand this read removePoint first, and think of a cube
  let res = []
  let altSlice:HC = {} // will describe the subset of slice that intersects hc
  for(let l in hc){
    if(l in slice){
      let altSliceL = {}
      for(let n of slice[l]){
        if(n in hc[l]) altSliceL[n] = hc[l][n]
      }
      let x = Object.assign({},hc,altSlice)
      x[l]={} // set row L of the current piece to be the complement of slice[l]
      for(let n in hc[l]){
        if(!(n in altSliceL))x[l][n]=hc[l][n]
      }
      res.push(x)
      altSlice[l] = altSliceL // future pieces
    }
    else altSlice[l]=hc[l]
  }
  return res
}

//Split a hypercuboid into pieces with a point removed
export function removePoint(hc:HC, point:Point):HC[]{
  // Think of a cube with a small cube in the lower front left corner removed.
  // We can cut this shape into 3 cuboids -
  // First we take a large cuboid off the top (leaving a fairly flat shape)
  // Then we take a rectange from the back
  // What remains is a long cuboid to the right of the removed cube
  let res = []
  let pt:HC = {}
  for(let l in point){
    let x = Object.assign({},hc,pt)
    x[l] = {...hc[l]}
    delete x[l][point[l][0]]
    res.push(x)
    pt[l] = Object.fromEntries([point[l]])
  }
  // put the larger pieces at the front to reduce memory usage
  return res
}

//utility export functions
export function lt(c:Coords):[number,number]{
  return [c[0],c[1]]
}

export function getLTFromLoc(loc:AxisLoc):[number,number]|null{
  switch(loc.type){
    case "physical":
      return lt(getStart(loc.move))
    case "arrive":
      return lt(getEnd(loc.move))
    case "leave":
      return lt(loc.source)
    case "pass":
      return loc.lt
  }
}
export type Rec<Key extends (string | number | symbol),Value> = Partial<Record<Key, Value>>
export type Graph<Node extends (string | number | symbol) ,Edge> = Record<Node,Rec<Node,Edge>>
type Path<Node> = {
  pair: [Node,Node]
  next:Path<Node>|null
}

// Given a graph, if a matching including all edges in `include` exists, return one.
//  If no such matching exists, return null
// Because we know the set of nodes that must be included, we just need to repeatedly search for
// augmenting paths. If we don't find such a path, there is no acceptable matching,
// if we do find one, we can include the node.
// https://en.wikipedia.org/wiki/Berge%27s_theorem applies here, adapted appropriately
export function findMatching<Node extends (string|number|symbol), Edge>
                            (g:Graph<Node,Edge>, include:Node[]) : null|Rec<Node,Edge>{
  let ns = Object.keys(g)
  let mustInc : Rec<Node,boolean> = {} // Set of nodes that must be included
  for(let n of include){
    mustInc[n] = true
  }
  let mtch : Rec<Node,Node> = {}
  for(let n of include){// make sure the matching includes all of these by finding augmenting paths
    //console.log(n)
    if (n in mtch) continue;
    let seen : Rec<Node,boolean> = {} //nodes seen at an odd distance from n (and n itself)
    seen[n]=true
    let ms = Object.keys(g[n]) as any[] as Node[]
    for(let m of ms) seen[m]=true;
    let cur : Path<Node>[] = ms.map(m=>({pair:[n,m], next:null}))
    let augment = null
    find_augment: while(cur.length!=0){
      //console.log("start",seen,cur)
      let next = []// next depth of bfs
      for(let p of cur){
        let u = p.pair[1]
        let n = mtch[u]
        if(n){
          if(mustInc[n]){
            let ms = Object.keys(g[n]).filter(m=>!seen[m])
            for(let m of ms) seen[m]=true
            ms.map(m=>next.push( {pair:[n,m], next:p} ))
          }
          else{
            augment={path:p, drop:n}
            break find_augment;
          }
        }
        else{
          augment={path:p}
          break find_augment;
        }
      }
      cur=next
    }
    //console.log(n,"aug",augment.drop,sh(augment.path))
    if(augment===null){
      return null
    }
    else{
      if(augment.drop) delete mtch[augment.drop];
      let p = augment.path
      while(p!==null){
        mtch[p.pair[0]]=p.pair[1]
        mtch[p.pair[1]]=p.pair[0]
        p=p.next
      }
    }
  }
  let result : Rec<Node,Edge> = {}
  for(let n in mtch){
    result[n] = g[n][mtch[n]]
  }
  return result
}
function sh(p){
  let res=[]
  while(p!==null){
    res.push(p.pair)
    p=p.next
  }return res
}