const express=require("express");
const router=express.Router();

const wrapAsync=require("../utils/wrapAsync.js");
const {isLoggedIn, isOwner,validateListing}=require("../middleware.js");
const listingController = require("../controllers/listings.js");
const multer=require("multer");
const {storage}=require("../cloudConfig.js");
const upload=multer({storage});
const bookingController=require("../controllers/bookings.js");

//Index And Create Route
router.route("/")
  .get(wrapAsync(listingController.index))
  .post(
      isLoggedIn,
      validateListing,//For server side validation
      upload.single('listing[image]'),
      wrapAsync(listingController.createListing)
  );

//New Route
router.get("/new", isLoggedIn,listingController.renderNewForm);
router.post("/:id/bookings",isLoggedIn,wrapAsync(bookingController.createBooking));

//Show, Update, Delete Route
router.route("/:id")
  .get(wrapAsync(listingController.showListing))
  .put(
      isLoggedIn,
      isOwner,
      validateListing,
      upload.single('listing[image]'),
  wrapAsync(listingController.updateListing)
  )
  .delete(
      isLoggedIn,
      isOwner,
      wrapAsync(listingController.destroyListing)
  );

//Edit Route
router.get("/:id/edit",
  isLoggedIn,
  isOwner,
  wrapAsync(listingController.renderEditForm)
  );

module.exports=router;