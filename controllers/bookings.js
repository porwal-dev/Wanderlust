const Joi=require("joi");
const Booking=require("../models/booking.js");
const Listing=require("../models/listing.js");

const bookingRequestSchema=Joi.object({
  booking:Joi.object({
    checkIn:Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    checkOut:Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    guests:Joi.number().integer().min(1).required()
  }).required()
});

const dateFromInput=(value)=>{
  const date=new Date(`${value}T00:00:00.000Z`);
  if(Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==value){
    return null;
  }
  return date;
};

const redirectWithError=(req,res,url,message)=>{
  req.flash("error",message);
  return res.redirect(url);
};

const getHostBooking=async(req,res)=>{
  const booking=await Booking.findById(req.params.bookingId).populate("listing");
  if(!booking){
    redirectWithError(req,res,"/bookings/host","Booking not found.");
    return null;
  }
  if(!booking.listing || !booking.listing.owner || !booking.listing.owner.equals(req.user._id)){
    redirectWithError(req,res,"/bookings/host","You can only manage requests for your own listings.");
    return null;
  }
  return booking;
};

module.exports.createBooking=async(req,res)=>{
  const listingPath=`/listings/${req.params.id}`;
  const {error,value}=bookingRequestSchema.validate(req.body,{abortEarly:false});
  if(error){
    return redirectWithError(req,res,listingPath,"Enter valid check-in, check-out, and guest details.");
  }

  const checkIn=dateFromInput(value.booking.checkIn);
  const checkOut=dateFromInput(value.booking.checkOut);
  const today=new Date();
  today.setUTCHours(0,0,0,0);
  if(!checkIn || !checkOut || checkIn<today || checkOut<=checkIn){
    return redirectWithError(req,res,listingPath,"Choose valid future dates with check-out after check-in.");
  }

  const listing=await Listing.findById(req.params.id);
  if(!listing){
    return redirectWithError(req,res,"/listings","That listing is no longer available.");
  }
  if(listing.owner && listing.owner.equals(req.user._id)){
    return redirectWithError(req,res,listingPath,"You cannot book your own listing.");
  }

  const confirmedConflict=await Booking.exists({
    listing:listing._id,
    status:"confirmed",
    checkIn:{$lt:checkOut},
    checkOut:{$gt:checkIn}
  });
  if(confirmedConflict){
    return redirectWithError(req,res,listingPath,"Those dates are already booked.");
  }

  const nights=(checkOut.getTime()-checkIn.getTime())/(24*60*60*1000);
  const nightlyPrice=listing.price;
  const totalPrice=Math.round(nightlyPrice*nights*100)/100;
  await Booking.create({
    listing:listing._id,
    guest:req.user._id,
    checkIn,
    checkOut,
    guests:value.booking.guests,
    nightlyPrice,
    totalPrice
  });

  req.flash("success","Booking request sent. The host will confirm or decline it.");
  return res.redirect("/bookings");
};

module.exports.myBookings=async(req,res)=>{
  const bookings=await Booking.find({guest:req.user._id})
    .populate("listing")
    .sort({createdAt:-1});
  res.render("bookings/index.ejs",{bookings});
};

module.exports.hostBookings=async(req,res)=>{
  const listings=await Listing.find({owner:req.user._id}).select("_id");
  const listingIds=listings.map((listing)=>listing._id);
  const bookings=await Booking.find({listing:{$in:listingIds}})
    .populate("listing")
    .populate("guest","username email")
    .sort({createdAt:-1});
  res.render("bookings/host.ejs",{bookings});
};

module.exports.cancelBooking=async(req,res)=>{
  const booking=await Booking.findById(req.params.bookingId);
  if(!booking){
    return redirectWithError(req,res,"/bookings","Booking not found.");
  }
  if(!booking.guest.equals(req.user._id)){
    return redirectWithError(req,res,"/bookings","You can only cancel your own bookings.");
  }
  if(!["pending","confirmed"].includes(booking.status)){
    return redirectWithError(req,res,"/bookings","This booking can no longer be cancelled.");
  }

  booking.status="cancelled";
  await booking.save();
  req.flash("success","Booking cancelled.");
  return res.redirect("/bookings");
};

module.exports.confirmBooking=async(req,res)=>{
  const booking=await getHostBooking(req,res);
  if(!booking){
    return;
  }
  if(booking.status!=="pending"){
    return redirectWithError(req,res,"/bookings/host","Only pending requests can be confirmed.");
  }

  const confirmedConflict=await Booking.exists({
    _id:{$ne:booking._id},
    listing:booking.listing._id,
    status:"confirmed",
    checkIn:{$lt:booking.checkOut},
    checkOut:{$gt:booking.checkIn}
  });
  if(confirmedConflict){
    return redirectWithError(req,res,"/bookings/host","These dates overlap with another confirmed booking.");
  }

  const confirmed=await Booking.findOneAndUpdate(
    {_id:booking._id,status:"pending"},
    {$set:{status:"confirmed"}},
    {new:true}
  );
  if(!confirmed){
    return redirectWithError(req,res,"/bookings/host","This request was already updated.");
  }
  req.flash("success","Booking confirmed.");
  return res.redirect("/bookings/host");
};

module.exports.declineBooking=async(req,res)=>{
  const booking=await getHostBooking(req,res);
  if(!booking){
    return;
  }
  if(booking.status!=="pending"){
    return redirectWithError(req,res,"/bookings/host","Only pending requests can be declined.");
  }

  const declined=await Booking.findOneAndUpdate(
    {_id:booking._id,status:"pending"},
    {$set:{status:"declined"}},
    {new:true}
  );
  if(!declined){
    return redirectWithError(req,res,"/bookings/host","This request was already updated.");
  }
  req.flash("success","Booking declined.");
  return res.redirect("/bookings/host");
};
