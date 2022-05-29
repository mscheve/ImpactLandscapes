# Impact Landscapes
Impact Landscapes is an interactive visualization system based on Voronoi treemaps that supports the interpretability and communication of Life Cycle Assessments (LCA).

<p align="center">A live demo version is hosted at: https://mscheve.github.io/ImpactLandscapes/</p>

![](/pics/ImpactLandscapes_ReadMe_Demo.png)

## Background
In recent years, the relevance of sustainable decision-making has continuously increased in solving society’s environmental challenges. Such decision-making should take a facts-based life cycle perspective to prevent burden-shifting and effectively tackle these challenges. Life Cycle Assessment (LCA) is an internationally standardized four-phase framework that aims to facilitate this by quantifying sustainability through a wide range of environmental impact indicators. While LCA has seen increased adoption since the 1990s, the visualization of its results does often not capture the complex underlying hierarchical structure and has predominantly been geared towards LCA experts. Consequently, LCA results are often hard to understand for, and communicate to, non-LCA experts like policy and decision-makers. 

Therefore, Impact Landscapes was developed in response to the following question:
<p align="center">
  <em>"How can the hierarchical decomposition of LCA results, called contribution trees, be visualized to support sustainable decision-making by improving interpretability and communication to a broader range of stakeholders?"</em> 
</p>


## Implementation and Repo details
Impact Landscapes was implemented as a single web page application. Most of its features have been developed and implemented with the open-source D3.js JavaScript library by [Bostock et al. (2011)](http://dx.doi.org/10.1109/TVCG.2011.185). 

File structure:
- _/\_data_preparation_: contains the raw data used for the demo cases and the scripts required to extract and transform the raw data from openLCA.
- _/css_: contains the custom CSS stylesheet
- _/data_: contains the transformed data for the demo cases
- _/js_: contains the custom JS scripts
  - _main.js_: the core script that orchestrates the rendering of Impact Landscapes and the surrounding UI
  - _impact_landscape.js_: the ImpactLandscape class that creates the actual landscapes and their UI elements (i.e. roadmap, annotations, hover window), called by main.js
  - _helpers.js_: several supplementary functions, called by both main.js and impact_landscapes.js
  - _datasets.js_: a JSON object that specifies the dataset paths
  - _indicators.js_: a JSON object that specifies indicator descriptions
 - _/pics_: contains the images used throughout Impact Landscapes (e.g. tutorial) and this repo

To use Impact Landscapes with your own data, you should add the contribution tree CSVs to the /data folder. Subsequently, you should specify the path of the newly added CSVs in datasets.js. The structure of the CSVs should be as follows:

| **id\*** | **parent_id\*** | **hierarchy_level** | **Process\*** | **Process_shorthand\*** | **Amount\*** | **Unit\*** | **Phase\*** | **Location\*** |
|:--|:--|:--|:--|:--|:--|:--|:--|:--|
| _the id of the process_ | _the id of the process' parent process in the contribution tree_ | _the level at which the process is located in the contribution tree_ | _the full descriptive name of the process_ | _the shorthand name of the process (3 words max recommended)_ | _the environmental impact amount_ | _the unit of the environmental impact_ | _the life cycle phase in which the process occurs_ | _the reference location of the process_ | 

\* _required attribute_

## Acknowledgements
Impact Landscapes was develop by M. Scheve during his thesis graduation project for the master's Data Science and Entrepreneurship at the Jheronimus Academy of Data Science ([JADS](https://www.jads.nl/?gclid=CjwKCAjws8yUBhA1EiwAi_tpEe67t-rCGWOklGZmwLknaH3mbQDmufj1ChbiHjh_J_vUnxLhs7OmJRoCni4QAvD_BwE)). The project was carried out through an internship at [Deloitte Consulting NL](https://www2.deloitte.com/nl/nl/services/consulting-deloitte.html), which provided financial compensation to the author. Special thanks go out to the supervisors R. Brussee (JADS), F. Geurts (Deloitte), and J. de Vlieg (JADS) for their guidance and support during the project!
