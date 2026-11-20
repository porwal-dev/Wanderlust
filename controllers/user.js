const User=require("../models/user.js");
const {userSchema}=require("../schema.js");

module.exports.renderSignUpForm=(req,res)=>{
  res.render("users/signup.ejs");
} ;

module.exports.signUp=async(req,res,next)=>{
  const {error,value}=userSchema.validate(
    {user:req.body},
    {abortEarly:false,stripUnknown:true}
  );
  if(error){
    req.flash("error",error.details.map((detail)=>detail.message).join(". "));
    return res.redirect("/signup");
  }

  const {username,email,password}=value.user;
  let registeredUser;
  try{
    registeredUser=await User.register(new User({email,username}),password);
    await new Promise((resolve,reject)=>{
      req.login(registeredUser,(err)=>{
        if(err){
          return reject(err);
        }
        resolve();
      });
    });
  } catch(err){
    if(err.name==="UserExistsError"){
      req.flash("error","That username is already taken. Please choose another.");
      return res.redirect("/signup");
    }
    return next(err);
  }

  req.flash("success",`Welcome to Wanderlust, ${username}!`);
  return res.redirect(res.locals.redirectUrl || "/listings");
} ;

module.exports.renderLoginForm=(req,res)=>{
  res.render("users/login.ejs");
} ;

module.exports.login=(req,res)=>{
  req.flash("success","Welcome back to Wanderlust!");
  return res.redirect(res.locals.redirectUrl || "/listings");
} ;

module.exports.logout=(req,res,next)=>{
  req.logout((err)=>{
    if(err){
      return next(err);
    }
    req.flash("success","Logged out Succesfully!");
    res.redirect("/listings");
  });

} ;