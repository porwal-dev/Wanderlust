const Joi=require("joi");
const Stripe=require("stripe");
const Booking=require("../models/booking.js");
const Listing=require("../models/listing.js");

const bookingRequestSchema=Joi.object({
  booking:Joi.object({
    checkIn:Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    checkOut:Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    guests:Joi.number().integer().min(1).required()
  }).required()
});

const getStripe=()=>{
  if(!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.startsWith("your_")){
    return null;
  }
  return Stripe(process.env.STRIPE_SECRET_KEY);
};

const getBaseUrl=(req)=>process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;

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

const refundPaidBooking=async(booking)=>{
  if(booking.paymentStatus!=="paid" || !booking.stripePaymentIntentId){
    return {ok:true,refunded:false};
  }
  const stripe=getStripe();
  if(!stripe){
    booking.paymentStatus="refund_failed";
    await booking.save();
    return {ok:false,refunded:false,message:"Stripe is not configured, so the payment could not be refunded automatically."};
  }
  try{
    await stripe.refunds.create({payment_intent:booking.stripePaymentIntentId});
    booking.paymentStatus="refunded";
    await booking.save();
    return {ok:true,refunded:true};
  }catch(err){
    booking.paymentStatus="refund_failed";
    await booking.save();
    return {ok:false,refunded:false,message:"The booking was updated, but the Stripe refund could not be completed automatically."};
  }
};

module.exports.createBooking=async(req,res)=>{
  const listingPath=`/listings/${req.params.id}`;
  const stripe=getStripe();
  if(!stripe){
    return redirectWithError(req,res,listingPath,"Payments are not configured yet. Add STRIPE_SECRET_KEY to your environment.");
  }

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
  if(nights<1){
    return redirectWithError(req,res,listingPath,"Choose valid dates with at least one night.");
  }
  const nightlyPrice=Number(listing.price)||0;
  const totalPrice=Math.round(nightlyPrice*nights*100)/100;
  const amountInPaise=Math.round(totalPrice*100);
  if(amountInPaise<1){
    return redirectWithError(req,res,listingPath,"This listing cannot be booked with the current price.");
  }

  const baseUrl=getBaseUrl(req);
  const session=await stripe.checkout.sessions.create({
    mode:"payment",
    payment_method_types:["card"],
    line_items:[{
      price_data:{
        currency:"inr",
        product_data:{
          name:listing.title,
          description:`${nights} night(s) in ${listing.location}, ${listing.country}`
        },
        unit_amount:amountInPaise
      },
      quantity:1
    }],
    metadata:{
      listingId:listing._id.toString(),
      guestId:req.user._id.toString(),
      checkIn:value.booking.checkIn,
      checkOut:value.booking.checkOut,
      guests:String(value.booking.guests),
      nightlyPrice:String(nightlyPrice),
      totalPrice:String(totalPrice)
    },
    success_url:`${baseUrl}/bookings/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:`${baseUrl}/bookings/checkout/cancel/${listing._id}`
  });

  return res.redirect(303,session.url);
};

module.exports.checkoutSuccess=async(req,res)=>{
  const stripe=getStripe();
  const sessionId=req.query.session_id;
  if(!stripe || !sessionId){
    return redirectWithError(req,res,"/bookings","Could not verify the payment session.");
  }

  const existing=await Booking.findOne({stripeSessionId:sessionId});
  if(existing){
    if(existing.guest.equals(req.user._id)){
      req.flash("success","Payment received. Your booking request is awaiting host approval.");
    }
    return res.redirect("/bookings");
  }

  const session=await stripe.checkout.sessions.retrieve(sessionId);
  if(session.payment_status!=="paid" || !session.metadata){
    return redirectWithError(req,res,"/bookings","Payment was not completed, so no booking was created.");
  }
  if(session.metadata.guestId!==req.user._id.toString()){
    return redirectWithError(req,res,"/bookings","You can only complete your own booking payment.");
  }

  const listing=await Listing.findById(session.metadata.listingId);
  const checkIn=dateFromInput(session.metadata.checkIn);
  const checkOut=dateFromInput(session.metadata.checkOut);
  const guests=parseInt(session.metadata.guests,10);
  const nightlyPrice=Number(session.metadata.nightlyPrice);
  const totalPrice=Number(session.metadata.totalPrice);

  if(!listing || !checkIn || !checkOut || !Number.isInteger(guests) || guests<1){
    req.flash("error","Payment was received, but the booking details could not be verified. Please contact support.");
    return res.redirect("/bookings");
  }

  const confirmedConflict=await Booking.exists({
    listing:listing._id,
    status:"confirmed",
    checkIn:{$lt:checkOut},
    checkOut:{$gt:checkIn}
  });
  const paymentIntentId=typeof session.payment_intent==="string" ? session.payment_intent : session.payment_intent && session.payment_intent.id;
  if(confirmedConflict){
    if(paymentIntentId){
      try{
        await stripe.refunds.create({payment_intent:paymentIntentId});
        req.flash("error","Those dates were booked while you were paying. Your payment was refunded.");
      }catch(err){
        req.flash("error","Those dates were booked while you were paying, but the refund could not be completed automatically. Please contact support.");
      }
    }else{
      req.flash("error","Those dates were booked while you were paying. Please contact support.");
    }
    return res.redirect(`/listings/${listing._id}`);
  }

  await Booking.create({
    listing:listing._id,
    guest:req.user._id,
    checkIn,
    checkOut,
    guests,
    nightlyPrice: Number.isFinite(nightlyPrice) ? nightlyPrice : listing.price,
    totalPrice: Number.isFinite(totalPrice) ? totalPrice : 0,
    currency:session.currency || "inr",
    status:"pending",
    paymentStatus:"paid",
    stripeSessionId:sessionId,
    stripePaymentIntentId:paymentIntentId
  });

  req.flash("success","Payment successful. Your booking request was sent and is awaiting host approval.");
  return res.redirect("/bookings");
};

module.exports.checkoutCancel=async(req,res)=>{
  const listingId=req.params.id;
  req.flash("error","Payment cancelled. Your booking request was not created.");
  if(listingId){
    return res.redirect(`/listings/${listingId}`);
  }
  return res.redirect("/listings");
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
  const refund=await refundPaidBooking(booking);
  if(booking.paymentStatus!=="paid"){
    await booking.save();
  }
  if(refund.refunded){
    req.flash("success","Booking cancelled and payment refunded.");
  }else if(refund.message){
    req.flash("success","Booking cancelled.");
    req.flash("error",refund.message);
  }else{
    req.flash("success","Booking cancelled.");
  }
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

  const refund=await refundPaidBooking(declined);
  if(refund.refunded){
    req.flash("success","Booking declined and payment refunded.");
  }else if(refund.message){
    req.flash("success","Booking declined.");
    req.flash("error",refund.message);
  }else{
    req.flash("success","Booking declined.");
  }
  return res.redirect("/bookings/host");
};
