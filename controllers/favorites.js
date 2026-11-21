const Listing=require("../models/listing.js");
const User=require("../models/user.js");

const returnPath=(req,fallback)=>{
  const target=req.body.returnTo;
  if(typeof target==="string" && target.startsWith("/") && !target.startsWith("//") && !target.includes("\\") && !/[\u0000-\u001f]/.test(target)){
    return target;
  }
  return fallback;
};

module.exports.index=async(req,res)=>{
  const user=await User.findById(req.user._id).populate("favorites");
  const listings=user ? user.favorites.filter(Boolean) : [];
  res.render("favorites/index.ejs",{listings});
};

module.exports.add=async(req,res)=>{
  const fallback=`/listings/${req.params.listingId}`;
  const listing=await Listing.findById(req.params.listingId);
  if(!listing){
    req.flash("error","That listing is no longer available.");
    return res.redirect("/listings");
  }

  await User.findByIdAndUpdate(req.user._id,{$addToSet:{favorites:listing._id}});
  req.flash("success","Listing saved to your favorites.");
  return res.redirect(returnPath(req,fallback));
};

module.exports.remove=async(req,res)=>{
  await User.findByIdAndUpdate(req.user._id,{$pull:{favorites:req.params.listingId}});
  req.flash("success","Listing removed from your favorites.");
  return res.redirect(returnPath(req,"/favorites"));
};
