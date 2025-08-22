const Listing=require("./models/listing.js");
const Review=require("./models/review.js");
const {listingSchema,reviewSchema}=require("./schema.js");
const ExpressError=require("./utils/expressError.js");
const wrapAsync=require("./utils/wrapAsync.js");

//Validation for listingSchema
module.exports.validateListing = (req, res, next) => {
  let { error } = listingSchema.validate(req.body);
  if (error) {
    let errMsg=error.details.map((ele)=>ele.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};

//Server side validation for reviewSchema joi
module.exports.validateReview = (req, res, next) => {
  let { error } = reviewSchema.validate(req.body);
  if (error) {
    let errMsg=error.details.map((ele)=>ele.message).join(",");
    throw new ExpressError(400, errMsg);
  } else {
    next();
  }
};
//Checks whether the user is logged in or not
module.exports.isLoggedIn=(req,res,next)=>{
  // console.log(req.path,"..",req.originalUrl);
  if(!req.isAuthenticated()){
    req.session.redirectUrl=req.originalUrl;  //After login where to redirect
    req.flash("error","Please Log in first");
    return res.redirect("/login");
  }
  next();
}

//Saves the url to redirect after login
module.exports.saveRedirectUrl=(req,res,next)=>{
  if(req.session.redirectUrl){ //As after login req.session will be reset
    res.locals.redirectUrl=req.session.redirectUrl;
  }
  next();
}

//Mathches the current user with owner to give authorization permissions
module.exports.isOwner=wrapAsync(async(req,res,next)=>{
      let { id } = req.params;
      let currListing=await Listing.findById(id);
      if(!res.locals.currUser._id.equals(currListing.owner)){
      req.flash("error","U don't have this permission");
      return res.redirect(`/listings/${id}`);
    }
    next();
});

//Mathches the current user with review author to give authorization permissions
module.exports.isReviewAuthor=wrapAsync(async(req,res,next)=>{
      let {id,reviewId}=req.params;
      reviewId = reviewId.trim();
      let currReview=await Review.findById(reviewId);
      if(!res.locals.currUser._id.equals(currReview.author._id)){
         req.flash("error","U don't have this permission");
         return res.redirect(`/listings/${id}`);
    }
    next();
});