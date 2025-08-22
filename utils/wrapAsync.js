module.exports=(fn)=>{
  return function (req,res,next){
    fn(req,res,next).catch((err)=>next(err));//Or write only .catch(next)
  }
}