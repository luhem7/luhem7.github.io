window.onload = function() {
    document.getElementById("notification").innerHTML= "Loading the dataset... (should take 10 seconds)" ;

    d3.csv("/data/zomato.csv", function(d) {
        return d;
        // return {
        //     make: d['model'].split(' ')[0],
        //     model : d.model,
        //     mpg : +d.mpg,
        //     cyl : +d.cyl,
        //     disp : +d.disp,
        //     hp : +d.hp,
        //     drat : +d.drat,
        //     wt : +d.wt,
        //     qsec : +d.qsec,
        //     vs : +d.vs,
        //     am : +d.am,
        //     gear : +d.gear,
        //     carb : +d.carb
        // };
    }).then(function(zb_data) {
        document.getElementById("notification").innerHTML= "Dataset has been loaded." ;
    });
};
