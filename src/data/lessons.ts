export type LessonIcon = "cloud-rain" | "recycle" | "trees"

export type LessonOption = {
  id: string
  text: string
}

export type ReadingStep = {
  type: "reading"
  title: string
  paragraphs: string[]
  bullets?: string[]
  note?: string
}

export type QuestionStep = {
  type: "question"
  title: string
  prompt: string
  options: LessonOption[]
  correctOptionId: string
  correctFeedback: string
  incorrectFeedback: string
}

export type LessonStep = ReadingStep | QuestionStep

export type LessonSource = {
  label: string
  url: string
}

export type Lesson = {
  id: string
  title: string
  description: string
  goal: string
  durationMinutes: number
  icon: LessonIcon
  steps: LessonStep[]
  takeaway: string
  sources: LessonSource[]
}

export const LESSONS: Lesson[] = [
  {
    id: "from-street-to-stream",
    title: "From Street to Stream",
    description: "Follow rainwater from your neighborhood and learn what it can carry along the way.",
    goal: "Understand stormwater runoff and what a watershed tells us about where water flows.",
    durationMinutes: 4,
    icon: "cloud-rain",
    steps: [
      {
        type: "reading",
        title: "A little litter, a bigger problem",
        paragraphs: [
          "Imagine you're walking down the street and notice a plastic wrapper near the curb. It doesn't seem like a big deal. Now imagine it starts raining. Water flows along the street, picks up the wrapper, and carries it toward a storm drain.",
          "Depending on the local drainage system, that water may travel to a stream, river, lake, or another body of water. The wrapper has not disappeared. It has simply moved somewhere else.",
          "This is one way a small problem in a neighborhood can become part of a larger environmental issue."
        ]
      },
      {
        type: "question",
        title: "Make a choice",
        prompt: "Why is it important to keep litter off the street?",
        options: [
          { id: "a", text: "Litter only looks bad, so there is no other reason to worry about it." },
          { id: "b", text: "Rain can carry litter into drains and waterways, where it can harm wildlife and habitats." },
          { id: "c", text: "Every piece of litter eventually reaches the ocean." }
        ],
        correctOptionId: "b",
        correctFeedback: "Exactly. Litter can be carried into waterways by runoff. Preventing it from entering the environment is a useful first step.",
        incorrectFeedback: "Think about what happens when water flows over a street. It can move loose litter into drains and waterways, although the final route depends on local drainage and the landscape."
      },
      {
        type: "reading",
        title: "What is stormwater runoff?",
        paragraphs: [
          "When rain falls on grass or soil, some water soaks into the ground. Plants can absorb some of it, and some may move deeper into the soil.",
          "Water cannot soak through roads, parking lots, and many sidewalks as easily. Instead, it flows across these surfaces. This moving water is called stormwater runoff.",
          "As runoff travels, it can pick up litter, soil, oil, fertilizer, and other pollutants. It can carry these materials into storm drains and waterways. Too much runoff can also contribute to flooding and erosion."
        ]
      },
      {
        type: "question",
        title: "Try this",
        prompt: "Which surface generally lets more rainwater soak into the ground?",
        options: [
          { id: "a", text: "A paved parking lot" },
          { id: "b", text: "A grassy area with healthy soil" },
          { id: "c", text: "A concrete sidewalk" }
        ],
        correctOptionId: "b",
        correctFeedback: "Correct. Healthy soil and vegetation can absorb some rainwater, though the amount depends on the soil and how wet it already is.",
        incorrectFeedback: "Paved surfaces generally produce more runoff because water cannot soak through them as easily. Grass and healthy soil can absorb some rainwater."
      },
      {
        type: "reading",
        title: "So, what exactly is a watershed?",
        paragraphs: [
          "Imagine tipping a little water onto the side of a hill. It flows downhill, following the shape of the land. Other drops join it, and eventually the water may enter a stream.",
          "A watershed is an area of land where water drains toward a shared destination, such as a stream, river, lake, or reservoir. Think of it as a giant, uneven bowl. Higher ground helps form its boundaries, while water flows downhill into connected waterways.",
          "A watershed can be small, such as the land draining into a pond, or huge, with many streams, rivers, towns, and cities inside it. Smaller watersheds can be part of larger ones. That is why activities far from a river can still affect it."
        ],
        note: "You are always somewhere within a watershed, even if you cannot see a river nearby."
      },
      {
        type: "question",
        title: "Think it through",
        prompt: "A neighborhood sits several miles from a river. Can activities in that neighborhood still affect the river?",
        options: [
          { id: "a", text: "No. Only places directly beside rivers can affect them." },
          { id: "b", text: "Yes. Runoff can carry materials into waterways connected to the river." },
          { id: "c", text: "Yes, because all rainwater travels to the same river." }
        ],
        correctOptionId: "b",
        correctFeedback: "That's right. Watersheds show how water connects different parts of the landscape. The exact route depends on the local terrain and drainage system.",
        incorrectFeedback: "Water can travel from streets and other surfaces through drainage systems and connected streams. Not all rainwater travels to the same river, though."
      },
      {
        type: "reading",
        title: "What can you do?",
        paragraphs: [
          "You do not have to solve an entire pollution problem to make a difference. Preventing a problem before it spreads is a good place to start.",
          "Dispose of litter properly and keep loose waste away from drains. If you notice a serious blockage or a possible hazardous spill, report it through the appropriate local service rather than trying to handle it yourself. Never enter a storm drain or approach floodwater."
        ],
        bullets: [
          "Put everyday waste in the right bin.",
          "Keep loose litter from washing away when it is safe to do so.",
          "Report serious hazards using a trusted local service."
        ]
      },
      {
        type: "question",
        title: "Final knowledge check",
        prompt: "What is one reason watersheds matter?",
        options: [
          { id: "a", text: "They show how water connects different parts of the landscape." },
          { id: "b", text: "They prevent all pollution from reaching rivers." },
          { id: "c", text: "They only exist in places with large rivers." }
        ],
        correctOptionId: "a",
        correctFeedback: "Lesson complete! Watersheds help us understand where water flows and how problems in one place can affect connected waterways.",
        incorrectFeedback: "Think about rain flowing downhill and smaller streams joining larger ones. Watersheds describe those connected drainage areas."
      }
    ],
    takeaway: "Water connects places that may seem far apart. Understanding your watershed helps you see how your neighborhood fits into a larger natural system.",
    sources: [
      { label: "NOAA: Watersheds, flooding, and pollution", url: "https://www.noaa.gov/education/resource-collections/freshwater/watersheds-flooding-and-pollution" },
      { label: "NOAA: It All Runs Downhill", url: "https://oceanservice.noaa.gov/education/dyw-downhill.html" }
    ]
  },
  {
    id: "recycle-right",
    title: "Recycle Right",
    description: "Learn why the item, its condition, and your local rules all matter.",
    goal: "Make better waste-disposal decisions instead of guessing based on appearance alone.",
    durationMinutes: 4,
    icon: "recycle",
    steps: [
      {
        type: "reading",
        title: "Is everything recyclable?",
        paragraphs: [
          "A plastic bottle and a plastic grocery bag are both made from plastic. Does that mean they belong in the same recycling bin? Not necessarily.",
          "Recycling programs accept specific items based on the materials they can collect and process. Some containers may be accepted, while bags, wrappers, foam packaging, and other items might need a different disposal method.",
          "An item can also be recyclable in principle but unsuitable for a particular bin if it is contaminated or if the local facility does not process it."
        ]
      },
      {
        type: "question",
        title: "Make a choice",
        prompt: "You have an empty plastic grocery bag. What is the best next step?",
        options: [
          { id: "a", text: "Put it in recycling because it is plastic." },
          { id: "b", text: "Check whether your local program accepts bags through curbside recycling or a separate drop-off." },
          { id: "c", text: "Assume every type of plastic is non-recyclable." }
        ],
        correctOptionId: "b",
        correctFeedback: "Good choice. Plastic bags are excluded from many curbside programs, but some places have separate collection options.",
        incorrectFeedback: "Plastic bags are not accepted in many household recycling bins. Check local instructions for a separate collection option instead of guessing."
      },
      {
        type: "reading",
        title: "Three things to check",
        paragraphs: [
          "You do not have to memorize every recycling rule. Start with three simple questions before putting something in the bin."
        ],
        bullets: [
          "What is the actual item? A bottle, wrapper, and foam container may need different disposal methods even if they are all plastic products.",
          "Is it in an acceptable condition? Food residue, grease, and leftover liquid can affect whether an item is accepted. Follow your program's instructions for preparing materials.",
          "Does your local program accept it? Rules vary between communities. An item might be accepted at a special drop-off location but not in a household recycling bin."
        ]
      },
      {
        type: "question",
        title: "Mini challenge",
        prompt: "A cardboard pizza box has grease and food stuck to the bottom. What should you do?",
        options: [
          { id: "a", text: "Recycle the whole box because it is cardboard." },
          { id: "b", text: "Follow your local rules for greasy or food-soiled cardboard." },
          { id: "c", text: "Recycle it if it has a recycling symbol." }
        ],
        correctOptionId: "b",
        correctFeedback: "Correct. Material alone does not settle the question. Local programs have different instructions for food-soiled cardboard.",
        incorrectFeedback: "Check local instructions for greasy cardboard. A recycling symbol alone does not guarantee that your local program accepts an item in its current condition."
      },
      {
        type: "reading",
        title: "Recycling is not the only answer",
        paragraphs: [
          "Recycling can recover useful materials, but reducing waste in the first place is important too.",
          "Before throwing something away, consider whether it can be reused, repaired, donated, or shared. A backpack, jacket, or working appliance might still be useful to someone else.",
          "Choosing durable items, avoiding unnecessary packaging, and using reusable products when practical can also reduce the amount of waste we create."
        ]
      },
      {
        type: "question",
        title: "Choose what you would do",
        prompt: "You have a backpack with a broken zipper, but the rest is in good condition. What might be the most useful first step?",
        options: [
          { id: "a", text: "Throw it away immediately." },
          { id: "b", text: "See whether the zipper can be repaired or the backpack can be reused." },
          { id: "c", text: "Put it in the paper recycling bin." }
        ],
        correctOptionId: "b",
        correctFeedback: "Exactly. Repairing or reusing something can extend its useful life and reduce the need for a replacement.",
        incorrectFeedback: "Before throwing an item away, consider whether it can be repaired, donated, or reused. Not everything can be repaired, but it is worth checking."
      },
      {
        type: "question",
        title: "Final knowledge check",
        prompt: "Your photo checker identifies an object as plastic. Does that guarantee that it belongs in your recycling bin?",
        options: [
          { id: "a", text: "Yes. All plastic items belong in recycling." },
          { id: "b", text: "No. The exact item and local recycling rules matter." },
          { id: "c", text: "No. Plastic can never be recycled." }
        ],
        correctOptionId: "b",
        correctFeedback: "Lesson complete! Material recognition is useful, but always check the rules for your local program.",
        incorrectFeedback: "Some plastic items are accepted and others are not. The exact item, its condition, and your local rules all matter."
      }
    ],
    takeaway: "The best recycling decision depends on the item, its condition, and the rules where you live. When you are unsure, check before you toss.",
    sources: [
      { label: "US EPA: How do I recycle common recyclables?", url: "https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables" }
    ]
  },
  {
    id: "healthy-streams",
    title: "What Makes a Healthy Stream?",
    description: "Discover how water, soil, plants, and wildlife work together.",
    goal: "Understand how vegetation, stable banks, and suitable habitats support freshwater ecosystems.",
    durationMinutes: 4,
    icon: "trees",
    steps: [
      {
        type: "reading",
        title: "Two very different streambanks",
        paragraphs: [
          "Imagine two streams. One has trees, shrubs, and grasses growing beside it. The other runs alongside bare soil with almost no vegetation.",
          "Plants along the water can help stabilize soil, provide shade, and create habitat for wildlife. They are one part of a healthy stream, although water quality, flow, temperature, and many other conditions matter too."
        ]
      },
      {
        type: "question",
        title: "Make a choice",
        prompt: "Which streamside environment is generally better equipped to protect its banks and provide habitat?",
        options: [
          { id: "a", text: "The stream with healthy vegetation" },
          { id: "b", text: "The stream with bare soil and no plants" },
          { id: "c", text: "Both always have exactly the same habitat conditions" }
        ],
        correctOptionId: "a",
        correctFeedback: "Correct. Healthy vegetation can help stabilize soil, provide habitat, shade the water, and slow some runoff.",
        incorrectFeedback: "Plants along a stream can support wildlife and help protect the banks. Other conditions also affect the health of a stream."
      },
      {
        type: "reading",
        title: "Why plants beside water matter",
        paragraphs: [
          "The area beside a stream or river is called a riparian zone. When it contains trees, shrubs, and other vegetation, it can act as a natural buffer between the water and nearby land.",
          "Roots help hold soil in place. Leaves and branches provide habitat for wildlife. Shade can help moderate water temperature, and vegetation can slow some runoff before it reaches the stream.",
          "These benefits do not make a stream immune to pollution. They are part of a larger system of protection and care."
        ],
        bullets: [
          "Roots can help stabilize streambanks and reduce erosion.",
          "Trees provide shade and can help keep water cooler in hot weather.",
          "Plants create food, shelter, and habitat for many organisms.",
          "Vegetation can slow some runoff and trap some sediment before it reaches the water."
        ]
      },
      {
        type: "question",
        title: "Quick check",
        prompt: "What is one important job of roots growing beside a stream?",
        options: [
          { id: "a", text: "Make all the water safe to drink" },
          { id: "b", text: "Help hold soil in place and reduce bank erosion" },
          { id: "c", text: "Prevent every drop of rain from reaching the stream" }
        ],
        correctOptionId: "b",
        correctFeedback: "That's right. Roots help stabilize soil, though how much erosion they prevent depends on the site and surrounding conditions.",
        incorrectFeedback: "Roots can help hold soil in place. They cannot make water automatically safe to drink or stop all runoff."
      },
      {
        type: "reading",
        title: "When soil ends up in the water",
        paragraphs: [
          "Erosion happens when soil is worn away by water, wind, or other forces. Along a stream, loose soil can wash into the water as sediment.",
          "Some sediment is natural. Too much can make water cloudy and cover parts of the streambed that aquatic organisms need for food or shelter.",
          "Erosion depends on many factors, including rainfall, soil conditions, vegetation, and how nearby land is used. A photograph alone cannot establish exactly what caused cloudy water or whether the water is contaminated."
        ]
      },
      {
        type: "question",
        title: "Choose your response",
        prompt: "You notice bare soil along a streambank and cloudy water after heavy rain. What is the most responsible response?",
        options: [
          { id: "a", text: "Assume the water is polluted and unsafe." },
          { id: "b", text: "Observe from a safe place and report a concern if appropriate, without claiming to know the cause." },
          { id: "c", text: "Enter the stream and test the water by touching or tasting it." }
        ],
        correctOptionId: "b",
        correctFeedback: "Good call. Observations can help identify a potential concern, but they do not confirm its cause. Stay out of the water and use appropriate local reporting channels when needed.",
        incorrectFeedback: "A photo or quick observation does not prove the cause or establish water quality. Stay on a safe path and report a concern through an appropriate service if needed."
      },
      {
        type: "reading",
        title: "Helping streams stay healthy",
        paragraphs: [
          "Healthy streams depend on several things working together. They need suitable water quality and flow, habitats where organisms can find food and shelter, and surrounding land that does not deliver excessive pollution or sediment.",
          "Protecting waterways can include preventing litter, managing runoff, protecting streamside vegetation, and monitoring conditions over time. Some restoration activities need trained professionals or landowner permission, so check local guidance before changing a streambank or removing debris."
        ]
      },
      {
        type: "question",
        title: "Final knowledge check",
        prompt: "How can vegetation along a stream help protect the environment?",
        options: [
          { id: "a", text: "It can stabilize banks, slow some runoff, and provide habitat." },
          { id: "b", text: "It removes every pollutant from the water." },
          { id: "c", text: "It makes water-quality monitoring unnecessary." }
        ],
        correctOptionId: "a",
        correctFeedback: "Lesson complete! Healthy vegetation supports stream ecosystems, alongside other conservation and monitoring efforts.",
        incorrectFeedback: "Plants can help protect streams, but they cannot solve every environmental problem by themselves. Think about roots, runoff, shade, and habitat."
      }
    ],
    takeaway: "A healthy stream is more than water that looks clean. Plants, stable banks, suitable temperatures, good water quality, and thriving habitats all play a part.",
    sources: [
      { label: "US EPA: Introduction to the Watershed Planning Process", url: "https://cfpub.epa.gov/watertrain/moduleFrame.cfm?object_id=904&parent_object_id=441" },
      { label: "US EPA: Stream Corridor Structure and Function", url: "https://www.epa.gov/sites/production/files/2015-06/documents/stream.pdf" }
    ]
  }
]
