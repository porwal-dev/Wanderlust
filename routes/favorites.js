const express=require("express");
const router=express.Router();
const wrapAsync=require("../utils/wrapAsync.js");
const {isLoggedIn}=require("../middleware.js");
const favoritesController=require("../controllers/favorites.js");

router.get("/",isLoggedIn,wrapAsync(favoritesController.index));
router.post("/:listingId/remove",isLoggedIn,wrapAsync(favoritesController.remove));
router.post("/:listingId",isLoggedIn,wrapAsync(favoritesController.add));

module.exports=router;
