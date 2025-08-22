const express=require("express");
const router=express.Router({mergeParams:true});

const wrapAsync=require("../utils/wrapAsync.js");
const { validateReview, isLoggedIn, isReviewAuthor } = require("../middleware.js");
const reviewController=require("../controllers/reviews.js");

//New Route, Create Route
router.post("/",
      isLoggedIn,
      validateReview,
      wrapAsync(reviewController.createReview)
  );

//Post delete route
router.delete("/:reviewId",
  isLoggedIn,
  isReviewAuthor,
  wrapAsync(reviewController.deleteReview)
);

module.exports=router;