/*
To use the impact landscapes with your own data: load your csv's into the data folder
and append a case with its corresponding data paths to the dataLink variable below.

You can switch between cases and datasets using the settings menu.
*/

const dataList = [
    {
        caseName: "Apple",
        datasets: [
            { name: 'Table Apple (1kg)', path: 'data/TableApple1kg_ClimateChange.csv' }
        ]
    },
    {
        caseName: "Chocolate",
        datasets: [
            { name: 'Milk Chocolate (180g) (average consumption mix)', path: 'data/MilkChocolate180g_ClimateChange.csv' },
            { name: 'Milk Chocolate (180g) (sourced from Ghana)', path: 'data/MilkChocolate180g_GH_ClimateChange.csv' },
            { name: 'Milk Chocolate (180g) (sourced from Indonesia)', path: 'data/MilkChocolate180g_ID_ClimateChange.csv' },
            { name: "Milk Chocolate (180g) (sourced from Cote d'Ivoire)", path: 'data/MilkChocolate180g_CI_ClimateChange.csv' },
        ]
    },
    {
        caseName: "Pizza",
        datasets: [
            { name: 'Pizza Bolognese (300g)', path: 'data/PizzaBolognese300g_ClimateChange.csv' },
            { name: 'Pizza Four Cheeses (300g)', path: 'data/PizzaFourCheeses300g_ClimateChange.csv' },
            { name: 'Pizza Margherita (300g)', path: 'data/PizzaMargherita300g_ClimateChange.csv' },
            { name: 'Pizza Quattro Stagioni (300g)', path: 'data/PizzaQuattroStagioni300g_ClimateChange.csv' },
            { name: 'Pizza Salami (300g)', path: 'data/PizzaSalami300g_ClimateChange.csv' },
            { name: 'Pizza Tuna (300g)', path: 'data/PizzaTuna300g_ClimateChange.csv' },
        ]
    }
]