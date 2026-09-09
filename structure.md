# Problem statement: Urban Waterlogging Nowcast for Hyderabad 

> Problems to solve:
- Predict which specific locations will waterlog in the next 1-3 because of rainfall, terrain and drainage data.
- Rank locations by severity and population exposed.
- Push actionable alerts to commuters and civic teams with safe alternate routes. 

> Expected output:
- Risk model producing a location-level flood probability for a test rainfall event. 
- Map interface showing hotspots, severity and affected road segments. 
- Alert prototype (SMS/app/WhatsApp) with route diversion suggestion. 

---

**We want to address the problem statement by implementing the following data and pre-requisities mentioned below first create a readme file and then after confirmation of tech stack and overall methodology go ahead**


# Mind dump

- Identify reasons for waterloggin in areas with high waterlogging.
- Identify core msitakes or vulnerabilities that cause waterloggings.

- ML models to use:
    - KNN.
    - K-cluster.
    - Random forest.
    - XGBoost
    - More deep learning models.
- How does disaster response force in Hyderabad currently identify prone areas?


# Addressing problems:
1. Predict which specific locations will waterlog in next 1-3 becuase of rainfall, terrain and drainage data:
> Factors to consider:
    - Terrain of the area.
    - Drainage system and previous data relating to drainage related water logging incidents.
    - centimeters of rainfall coupled with terrain and drainage system that will cause waterlogging.

    - Take this factors and throw into an ML model which will spit out 2 things:
        - A number between 0 to 1, with 0 with least priority and 1 being of highest priority for Disaster response force to be mobilized.
        - A map signifying clusters in different colours: green for safe, yellow for prone and red for high priority at admin side so that not just based on number that was given out by number but also human judgement can interfere by looking at Map actively.
    - Identify reasons for disastre that has happened in Nepal and if possible try to make some connections.

2. Rank locations by severity and population exposed:
    - Draw, histograms (severity Vs Population exposed) and calculate the  ration or slope explaining the severity of calamity based on the population size affected.
    - Again terrain will play a role here to determine the probability for water to be logged.
    - Bring out an estimate of economic, social and public loss (How to do that? include it).
    - Historic rainfall data should also be considered.

3. Alert prototype with diversion suggestions:
    - Based on the number of severity or **index of severity** identify the areas with high probability waterloggings and send an SMS / Whatsapp message to local residents warning of the calamity / distress that will be caused.
    - Do it via twilio.

# Expected outcome:
1. Risk model producing a location-level flood probability for a test rainfall event. 
2.  Map interface showing hotspots, severity and affected road segments. 
3. Alert prototype (SMS/app/WhatsApp) with route diversion suggestion. 

> MVP: Monsoon starts --> Our application starts --> ML model predicts --> Messages are sent to local residents --> overall map is displayed at admin side --> Disaster response force is mobilized with index of severity and human decision.