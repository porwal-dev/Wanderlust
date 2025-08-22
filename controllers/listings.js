const Listing=require("../models/listing.js");
const mbxgeocodingClient = require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken=process.env.MAP_TOKEN;
const geocodingClient = mbxgeocodingClient({ accessToken: mapToken });

module.exports.index=async (req, res) => {
    let listings = await Listing.find({});
    res.render("listings/index.ejs", { listings });
  };

module.exports.renderNewForm=(req, res) => {
  res.render("listings/new.ejs");
};

module.exports.createListing=async (req, res, next) => {
  let response=await geocodingClient.forwardGeocode({
  query: req.body.listing.location,
  limit: 1,
})
  .send();

    let url=req.file.path;
    let filename=req.file.filename;
    console.log(url, "..", filename);

    const newListing = new Listing(req.body.listing);
    
    newListing.owner=req.user._id;
    newListing.image={url,filename};
    newListing.geometry=response.body.features[0].geometry;
    let savedListing=await newListing.save();
    console.log(savedListing);
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
      res.render("listings/show.ejs", {listing});
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
        res.render("listings/edit.ejs", { listing,originalImageUrl });
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
    await Listing.findByIdAndDelete(id);
    req.flash("success","Listing deleted Successfully!")
    res.redirect("/listings");
  };