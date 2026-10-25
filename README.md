# TerraTrack

TerraTrack is a community-focused environmental app that helps people document local environmental issues, explore reports, check whether common waste items may be recyclable, and learn practical ways to reduce their impact.

## Features

-   **Environmental reporting:** Submit a report with a title,
    description, issue category, and location.
-   **AI-assisted report analysis:** Get a suggested category, summary,
    and severity based on the report details.
-   **Interactive map and community feed:** Explore environmental
    reports and see issues affecting nearby areas.
-   **Watershed Lens:** Connect local observations with watershed and
    environmental context.
-   **Recycling checker:** Upload or capture a photo of a waste item to
    receive a model-based recyclability prediction.
-   **Environmental learning:** Read short lessons and complete quizzes
    to reinforce what you learn.
-   **Progress tracking:** Keep lesson completion and best quiz scores
    in local browser storage.

## Tech Stack

-   React and TypeScript
-   Vite
-   Tailwind CSS and shadcn/ui components
-   React Router
-   Supabase for backend services and report data
-   ONNX Runtime Web for browser-based waste image classification
-   Leaflet and React Leaflet for interactive maps

## Getting Started

### Requirements

Install a recent version of [Node.js](https://nodejs.org/) and npm.

### Install dependencies

Clone the repository and move into the project directory:

``` bash
git clone <repository-url>
cd <project-directory>
npm install
```

If you are working on a specific branch, check it out before installing
or running the app:

``` bash
git checkout Watershed-Lens
```

### Configure environment variables

Create a `.env.local` file in the project root and add your Supabase
project URL and public anon key:

``` env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Use the public client key intended for browser applications. Never put a
Supabase service-role key or other private secrets in a frontend
environment file.

Some features require a configured Supabase project and the matching
database schema. Check the `supabase/` directory for project migrations
and setup details.

### Run locally

``` bash
npm run dev
```

Vite will print a local development URL in the terminal. Open that
address in your browser.

### Build for production

``` bash
npm run build
```

To run the production build locally:

``` bash
npm run preview
```

## Project Structure

``` text
.
├── src/
│   ├── components/       # Shared interface components and navigation
│   ├── data/             # Environmental lessons and quiz content
│   ├── lib/              # Supabase, classification, and watershed utilities
│   └── pages/            # Map, feed, reporting, recycling, and learning pages
├── recycle-model-training/ # Waste classifier training workflow and documentation
├── supabase/             # Database migrations and Supabase configuration
├── public/               # Static assets
└── package.json
```

Folder names may change as the project develops.

## Recycling Model

The recycling checker uses an image classification model to identify
waste materials and map its prediction to a recyclable or non-recyclable
result. Model predictions are estimates, not guarantees. Local recycling
rules vary, and an item may be rejected if it is contaminated or made
from a material that a local program does not accept. When in doubt,
check your local recycling guidance.

The `recycle-model-training/` directory contains documentation for the
model training workflow, including dataset preparation, training, and
evaluation.

## Notes and Limitations

-   Location access must be granted by the browser for features that
    depend on the user's current location.
-   Supabase-dependent features need valid environment variables and a
    correctly configured backend.
-   AI-assisted report categorization is a suggestion and should be
    reviewed for accuracy.
-   Recycling predictions can be incorrect, especially for unusual
    items, mixed materials, or poor-quality photos.
-   Learning progress is stored in the current browser and may not
    transfer to another device or browser.
-   Photo storage for environmental reports depends on the storage
    implementation configured in the backend.

## Contributing

Contributions and bug reports are welcome. Before submitting changes,
test the affected workflows locally and describe the purpose of the
change clearly.

## License

Add the project's license here if and when one is selected.
