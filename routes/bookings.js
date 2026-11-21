const express=require("express");
const router=express.Router();
const wrapAsync=require("../utils/wrapAsync.js");
const {isLoggedIn}=require("../middleware.js");
const bookingController=require("../controllers/bookings.js");

router.get("/",isLoggedIn,wrapAsync(bookingController.myBookings));
router.get("/host",isLoggedIn,wrapAsync(bookingController.hostBookings));
router.post("/:bookingId/cancel",isLoggedIn,wrapAsync(bookingController.cancelBooking));
router.post("/:bookingId/confirm",isLoggedIn,wrapAsync(bookingController.confirmBooking));
router.post("/:bookingId/decline",isLoggedIn,wrapAsync(bookingController.declineBooking));

module.exports=router;
