
export type Piece = string // Case indicates color, " " indicates empty
export type Coords = [number,number,number,number] // l,t,x,y
export type Board2D = Piece[][]
export type Move = {
  start : Coords,
  end : Coords,
  changed : Coords[],
  newBoards : Record<number,Board2D> // for branching moves, the board on the
  // new timeline should be associated with the l-index of end even though
  // the board would not get added to that timeline
}
export function getStart(mv:Move):Coords {
  return mv.start
}
export function getEnd(mv:Move):Coords{
  return mv.end
}
export function getNewBoards(mv:Move):Record<number,Board2D>{
  return mv.newBoards
}

export type GameState = object


//functions without a reasonable implementation

// Returns the l-index where a new timeline would be created
export function getNewL(gs:GameState):number{
  return 1
}
// Returns the l-index of the timeline most recently created by the opponent
export function getOpL(gs:GameState):number{
  return -1
}
// Returns the T-index of the last borad on a timeline
export function getEndT(gs:GameState,l:number):number{
  return 0
}
//Returns a list of the moves originating from some timeline,
// grouped by the piece that moves
export function movesFrom(gs:GameState,l:number):Move[]{
  let res=[]
  for(let piece of []){
    for(let move of [piece]){
      res.push(move)
    }
  }
  return res
}
// return an array of the timelines on which it is the current player's turn
export function getPlayableTimelines(gs:GameState):number[]{
  return []
}
// Given a GameState, return a 2D array of available moves from each playable timeline. Optionally, this may cull moves which result in check, except for cross-timeline checks involving a newly created board.
export function getAllMoves (gs : GameState) : Move[][]{
  return []
}
export function applyMoves (gs : GameState, ms : Move[]) : GameState{
  return {}
}
// Returns a list of positions involved in a check
export function getCheckPath(gs : GameState) : [number,number,number,number][] | null{
  return null
}

// return true if the l and t coordinates of pos indicate a board which exists in state
export function posExists(state:GameState,pos:Coords):boolean {
  return getFromState(state,pos)!==null
}
// return the piece at a particular position, or null if the position doesn't exist
// may also crash on an illegal position (so long as you don't use the implementation of posExists above)
export function getFromState(state:GameState,pos:Coords):Piece | null {
  return null
}
// return the piece on given position in a board
export function getFrom2D(board:Board2D,pos:[number, number]) : Piece | null {
  return board[pos[0]][pos[1]]
}