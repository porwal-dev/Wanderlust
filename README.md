# Wanderlust

Wanderlust is a full-stack travel and accommodation listing web application inspired by Airbnb. It allows users to browse places to stay, create and manage listings, upload listing images, view locations on a map, and leave reviews.

The project uses a server-rendered MVC architecture: Express handles routes and application logic, MongoDB stores the data, EJS renders the pages, and Passport manages user authentication.

## Features

### Listing management
- Browse all accommodation listings on the home page.
- Search listing titles, destinations, and countries.
- Filter listings by category and nightly price range, and sort by price.
- Open a listing to view its title, description, owner, price, location, country, images, reviews, and map.
- Create new listings through a logged-in user interface.
- Edit and delete listings owned by the currently logged-in user.
- Upload listing images to Cloudinary.
- Automatically geocode listing locations with Mapbox and store geographic coordinates.

### User accounts
- Sign up with a username, email, and password.
- Log in and log out.
- Server-side signup validation for required fields and email format, with feedback for duplicate usernames.
- Successful signup automatically logs the user in.
- Session-based authentication with Passport Local.
- MongoDB-backed session storage.
- Redirect users back to their originally requested page after login.

### Reviews
- Logged-in users can add a 1-to-5-star rating and comment.
- Review authors can delete their own reviews.
- Deleting a listing removes its associated reviews.

### Interface
- Responsive Bootstrap 5 layout.
- Flash success and error notifications.
- Client-side and server-side form validation.
- Font Awesome icons and Google Fonts.
- Listing and review card layouts.
- A tax toggle that displays or hides an additional 18% GST label on the home page.
- A Mapbox map and marker on listing detail pages.

## Tech Stack

| Area | Technology |
|---|---|
| Runtime | Node.js 20.17.0 |
| Web framework | Express 5 |
| Database | MongoDB with Mongoose |
| Server-side views | EJS and EJS-Mate |
| Authentication | Passport, Passport Local, passport-local-mongoose |
| Sessions | express-session and connect-mongo |
| Validation | Joi for listing and review payloads |
| File uploads | Multer and multer-storage-cloudinary |
| Image hosting | Cloudinary |
| Geocoding and maps | Mapbox SDK and Mapbox GL JS |
| UI | Bootstrap 5, Font Awesome, custom CSS |

## Project Structure

```text
Wanderlust/
├── app.js                 # Application setup, middleware, database connection, and routes
├── cloudConfig.js         # Cloudinary and Multer storage configuration
├── middleware.js          # Authentication, authorization, and Joi validation middleware
├── schema.js              # Joi validation schemas
├── controllers/
│   ├── listings.js        # Listing CRUD and geocoding logic
│   ├── reviews.js         # Review create/delete logic
│   └── user.js            # Signup, login, and logout logic
├── models/
│   ├── listing.js         # Listing schema and review cleanup hook
│   ├── review.js          # Review schema
│   └── user.js            # Passport Local user schema
├── routes/
│   ├── listing.js         # /listings routes
│   ├── review.js          # Nested review routes
│   └── user.js            # Signup, login, and logout routes
├── views/
│   ├── layouts/           # Shared page layout
│   ├── includes/          # Navbar and flash/footer partials
│   ├── listings/          # Listing pages and error page
│   └── users/             # Signup and login pages
├── public/
│   ├── css/               # Application styles
│   └── js/                # Browser validation, tax toggle, and map code
├── init/
│   ├── index.js           # Optional local database seeding script
│   └── data.js            # Sample listing data
└── utils/
    ├── expressError.js     # Custom HTTP error class
    ├── listingCategories.js # Shared listing category definitions
    └── wrapAsync.js        # Async route error wrapper
```

## Data Models

### User
- `username` and password fields are handled by `passport-local-mongoose`.
- `email` is required.
- A user can own listings and author reviews.

### Listing
- Title
- Description
- Cloudinary image URL and filename
- Price
- Location and country
- Category
- Array of associated reviews
- Owning user
- GeoJSON `Point` geometry containing longitude and latitude

### Review
- Comment
- Rating from 1 to 5
- Creation date
- Authoring user

## Routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/` | Home/listing index |
| `GET` | `/listings` | Listing index |
| `GET` | `/listings/new` | New-listing form |
| `POST` | `/listings` | Create listing |
| `GET` | `/listings/:id` | Listing details |
| `GET` | `/listings/:id/edit` | Edit-listing form |
| `PUT` | `/listings/:id` | Update listing |
| `DELETE` | `/listings/:id` | Delete listing |
| `POST` | `/listings/:id/reviews` | Add review |
| `DELETE` | `/listings/:id/reviews/:reviewId` | Delete review |
| `GET/POST` | `/signup` | Signup form and account creation |
| `GET/POST` | `/login` | Login form and authentication |
| `GET` | `/logout` | Logout |

## Prerequisites

- Node.js 20 or later
- npm
- A MongoDB Atlas cluster or a local MongoDB server
- A Cloudinary account
- A Mapbox access token

## Environment Variables

If you do not already have a `.env` file, copy `.env.example` to `.env` in the project directory, then replace the sample values with your own. Do not overwrite an existing `.env`; keep your local credentials there.

```env
ATLASDB_URL=mongodb://127.0.0.1:27017/wanderlust
SECRET=your_long_random_session_secret

CLOUD_NAME=your_cloudinary_cloud_name
CLOUD_API_KEY=your_cloudinary_api_key
CLOUD_API_SECRET=your_cloudinary_api_secret

MAP_TOKEN=your_mapbox_public_access_token
```

For PowerShell, copy the template with:

```powershell
Copy-Item .env.example .env
```

For MongoDB Atlas, set `ATLASDB_URL` to the Atlas connection string. The application will not start successfully if the database connection string is missing or invalid.

Keep `.env` private. It is already excluded by `.gitignore`.

## Installation

```powershell
cd D:\projects\wanderlust_main\Wanderlust
npm install
```

Create the `.env` file described above, then start the application:

```powershell
node app.js
```

Open `http://localhost:3000` in a browser.

The project currently does not define a `start`, `dev`, or test npm script, so `node app.js` is the direct run command.

## Optional Local Seed Data

The `init` directory contains sample listings:

```powershell
node init/index.js
```

This seed script:
- Deletes every existing listing in the local `wanderlust` database.
- Inserts sample listings.
- Assigns them to a hard-coded local owner ID.

Use it only on a disposable database and with a matching user ID if you want seeded listings to be editable. The seed script connects directly to `mongodb://127.0.0.1:27017/wanderlust`, independently of `ATLASDB_URL`.

## Authorization Rules

- Users must be logged in to create listings or reviews.
- Only a listing owner can edit or delete that listing.
- Only a review author can delete that review.
- The server validates listing and review forms with Joi.
- The UI also performs Bootstrap browser validation.

## Error Handling

The application includes custom HTTP errors and an async route wrapper. Invalid routes render an error page instead of returning a generic server response. Listing and review validation failures, authentication failures, and successful actions use flash messages.

## Current Limitations

- The project has no automated test suite (`npm test` is only a placeholder).
- No booking or payment flow is implemented.
- The 18% GST shown on listing cards is a UI demonstration; it is not connected to a checkout calculation.
- The seed script uses a fixed owner ID and a separate local database connection.
- Cloudinary, Mapbox, and MongoDB credentials must be configured before the related features can work.

## Security Notes

- Use a strong, random value for `SECRET`.
- Restrict Cloudinary and Mapbox credentials appropriately.
- Do not commit `.env` or credentials.
- The application enables HTTP-only cookies and stores session data in MongoDB.
