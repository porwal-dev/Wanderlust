const Listing=require("../models/listing.js");
const Booking=require("../models/booking.js");
const mbxgeocodingClient = require('@mapbox/mapbox-sdk/services/geocoding');
const Joi=require("joi");
const listingCategories=require("../utils/listingCategories.js");
const mapToken=process.env.MAP_TOKEN;
const geocodingClient = mbxgeocodingClient({ accessToken: mapToken });

const categoryNames=listingCategories.map((category)=>category.name);
const listingFilterSchema=Joi.object({
  q:Joi.string().trim().max(100).allow(""),
  category:Joi.string().valid(...categoryNames).allow(""),
  minPrice:Joi.number().min(0).allow(""),
  maxPrice:Joi.number().min(0).allow(""),
  sort:Joi.string().valid("","price-asc","price-desc").allow("")
}).unknown(false);

const escapeRegex=(value)=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

module.exports.index=async (req, res) => {
    const {error,value}=listingFilterSchema.validate(req.query);
    if(error){
      req.flash("error","Please check your listing filters and try again.");
      return res.redirect("/listings");
    }

    const filters={
      q:value.q || "",
      category:value.category || "",
      minPrice:value.minPrice === undefined ? "" : value.minPrice,
      maxPrice:value.maxPrice === undefined ? "" : value.maxPrice,
      sort:value.sort || ""
    };

    if(filters.minPrice !== "" && filters.maxPrice !== "" && filters.minPrice > filters.maxPrice){
      req.flash("error","Minimum price cannot be greater than maximum price.");
      return res.redirect("/listings");
    }

    const criteria={};
    if(filters.q){
      const search=new RegExp(escapeRegex(filters.q),"i");
      criteria.$or=[
        {title:search},
        {location:search},
        {country:search}
      ];
    }
    if(filters.category){
      criteria.category=filters.category;
    }

    const price={};
    if(filters.minPrice !== ""){
      price.$gte=filters.minPrice;
    }
    if(filters.maxPrice !== ""){
      price.$lte=filters.maxPrice;
    }
    if(Object.keys(price).length){
      criteria.price=price;
    }

    let listingsQuery=Listing.find(criteria);
    if(filters.sort){
      listingsQuery=listingsQuery.sort({price:filters.sort === "price-asc" ? 1 : -1});
    }
    const listings=await listingsQuery;
    const favoriteIds=req.user ? req.user.favorites.map((id)=>id.toString()) : [];
    res.render("listings/index.ejs",{
      listings,
      filters,
      categories:listingCategories,
      favoriteIds,
      returnTo:req.originalUrl
    });
  };

module.exports.renderNewForm=(req, res) => {
  res.render("listings/new.ejs",{categories:listingCategories});
};

module.exports.createListing=async (req, res, next) => {
  let response=await geocodingClient.forwardGeocode({
  query: req.body.listing.location,
  limit: 1,
})
  .send();

    let url=req.file.path;
    let filename=req.file.filename;

    const newListing = new Listing(req.body.listing);
    
    newListing.owner=req.user._id;
    newListing.image={url,filename};
    newListing.geometry=response.body.features[0].geometry;
    await newListing.save();
    req.flash("success","New Listing Added");
    res.redirect("/listings");
  };

  module.exports.showListing=async (req, res) => {
      let { id } = req.params;
      let listing = await Listing.findById(id)
      .populate({
        path:"reviews",
        populate:{
          path:"author",
        }
      })
      .populate("owner");
      if(!listing){
        req.flash("error","Listing u requested for DNE!");
        return res.redirect("/listings");
      }
      const favoriteIds=req.user ? req.user.favorites.map((favoriteId)=>favoriteId.toString()) : [];
      res.render("listings/show.ejs",{
        listing,
        isFavorite:favoriteIds.includes(listing._id.toString())
      });
    };

    module.exports.renderEditForm=async (req, res) => {
      let { id } = req.params;
        let listing = await Listing.findById(id);
        if(!listing){
          req.flash("error","Listing u requested for DNE!");
          return res.redirect("/listings");
        }
        let originalImageUrl=listing.image.url;
        originalImageUrl=originalImageUrl.replace("/upload","/upload/w_250");
        res.render("listings/edit.ejs", { listing,originalImageUrl,categories:listingCategories });
      };

    module.exports.updateListing=async (req, res) => {
    let { id } = req.params;
    let oldListing=await Listing.findById(id);
    let newListing=await Listing.findByIdAndUpdate(id,{ ...req.body.listing },{new:true});

     if(oldListing.location!=newListing.location){
      let response=await geocodingClient.forwardGeocode({
       query: req.body.listing.location,
       limit: 1,
})
  .send();
      newListing.geometry=response.body.features[0].geometry;
      await newListing.save();
     }

    if(typeof(req.file)!=="undefined"){
       let url=req.file.path;
       let filename=req.file.filename;
       newListing.image={url,filename};
       await newListing.save();
    }
    req.flash("success","Listing Updated Successfully!");
    res.redirect(`/listings/${id}`);
  };

  module.exports.destroyListing=async (req, res) => {
    let { id } = req.params;
    const activeBooking=await Booking.exists({
      listing:id,
      status:{$in:["pending","confirmed"]}
    });
    if(activeBooking){
      req.flash("error","This listing has pending or confirmed bookings and cannot be deleted.");
      return res.redirect(`/listings/${id}`);
    }
    await Listing.findByIdAndDelete(id);
    req.flash("success","Listing deleted Successfully!")
    res.redirect("/listings");
  };