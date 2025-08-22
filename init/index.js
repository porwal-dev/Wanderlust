const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js"); //Use double dots - caution 

async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/wanderlust");
}
main()
  .then(() => {
    console.log("Connection successful");
  })
  .catch((err) => {
    console.log("Some error in DB-1", err);
  });
const initDB = async () => {
  try {
    await Listing.deleteMany({}); //Completely cleans our database
    //Add listing owner
    initData.data=initData.data.map((obj)=>({
      ...obj,
      owner:'689d4fb43e2073d2487309ed'
    }));
    await Listing.insertMany(initData.data);// initData-object we want its value- object.key
    console.log("Data initialized successfully");
  } catch (err) {
    console.log(err);
  }
};

initDB();