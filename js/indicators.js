/* 
source of descriptions https://ecochain.com/knowledge/impact-categories-lca/
this list is non-exhaustive and should be extended to your preference

warning: indicator descriptions and unit definitions might vary between LCIA methods
*/

const indicators = {
    'kg CO2 eq': { 
        indicator: 'climate change', 
        description: 'Indicator of potential global warming due to emissions of greenhouse gases to air. Divided into 3 subcategories based on the emission source: (1) fossil resources, (2) bio-based resources and (3) land use change.' 
    },
    'kg CFC11 eq': { 
        indicator: 'ozone depletion', 
        description: 'Indicator of emissions to air that cause the destruction of the stratospheric ozone layer.' 
    },
    'mol H+ eq': { 
        indicator: 'acidification', 
        description: 'Indicator of the potential acidification of soils and water due to the release of gases such as nitrogen oxides and sulphur oxides.' 
    },
    'kg P eq': { 
        indicator: 'eutrophication (freshwater)', 
        description: 'indicator of the enrichment of the fresh water ecosystem with nutritional elements, due to the emission of nitrogen or phosphor containing compounds.' 
    },
    'kg N eq': { 
        indicator: 'eutrophication (marine)', 
        description: 'Indicator of the enrichment of the marine ecosystem with nutritional elements, due to the emission of nitrogen containing compounds.' 
    },
    'mol N eq': { 
        indicator: 'eutrophication (terrestrial)', 
        description: 'Indicator of the enrichment of the terrestrial ecosystem with nutritional elements, due to the emission of nitrogen containing compounds.' 
    },
    'CTUe': { 
        indicator: 'eco-toxicity', 
        description: 'Impact organisms of toxic substances emitted to the environment.' 
    },
    'm3 depriv.': { 
        indicator: 'water use', 
        description: 'Indicator of the relative amount of water used, based on regionalized water scarcity factors.' 
    },
    'Pt': { 
        indicator: 'land use', 
        description: 'Measure of the changes in soil quality (Biotic production, Erosion resistance, Mechanical filtration).' 
    },
    'kBq U-235': { 
        indicator: 'ionising radiation', 
        description: 'Damage to human health and ecosystems linked to the emissions of radionuclides.' 
    },
    'CTUh': { 
        indicator: 'human toxicity', 
        description: 'Impact on humans of toxic substances emitted to the environment. Divided into non-cancer and cancer related toxic substances.' 
    },
    'kg Sb eq': { 
        indicator: 'resource use (minerals & metals)', 
        description: 'Indicator of the depletion of natural non-fossil resources.' 
    },
    'MJ': { 
        indicator: 'resource use (fossils)', 
        description: 'Indicator of the depletion of natural fossil fuel resources.' 
    },
    'kg NMVOC eq': { 
        indicator: 'Photochemical ozone formation', 
        description: 'Indicator of emissions of gases that affect the creation of photochemical ozone in the lower atmosphere (smog) catalysed by sunlight.' 
    },
    'disease inc.': { 
        indicator: 'particulate matter', 
        description: '	Indicator of the potential incidence of disease due to particulate matter emissions.' 
    },
}