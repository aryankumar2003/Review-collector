'use client';
import { use, useEffect, useState } from "react";
import { Command, CommandGroup, CommandInput, CommandList } from "./ui/command";
import { CommandEmpty, CommandItem, CommandSeparator } from "cmdk";
import autocomplete from "@/lib/google";
import { PlaceAutocompleteResult } from "@googlemaps/google-maps-services-js";



export const Dashboard = () => {
  
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [predictions,setPrediction] = useState<PlaceAutocompleteResult[]>([]);
    const [input,setInput]=useState<string>("");

    const handleSearchClick = async () => {
        setLoading(true); // Start loading
        try {
            const response = await fetch(`http://localhost:3000/api/scrape-reviews?searchTerm=${input}`);
            const data = await response.json();
            setSearchResults(data);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false); // End loading
        }
    };

    const displayResults = () => {
        if (loading) return <p>Loading...</p>;
        if (searchResults.length === 0) return <p>No results yet.</p>;

        return searchResults.map((result, index) => (
            <div key={index}>
                <h2>{result.fullName}</h2>
                <p>{result.stars}</p>
                <p>{result.reviewText}</p>
            </div>
        ));
    };


    useEffect(() => {
        const fetchPredictions = async () => {
           const prediction = await autocomplete(input);
           const formattedPrediction = prediction.map((item) => ({ description: item } as PlaceAutocompleteResult));
           setPrediction(formattedPrediction || []);
        };

        fetchPredictions();
    }, [input]);
    return (
        <div>
            <h1>Dashboard</h1>
            <div>
                <Command>
                    <CommandInput placeholder="Enter business name or location"  
                    value={input}
                    onValueChange={setInput}/>
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup heading="Suggestions">
                           {predictions.map((index) => (
                            <div onClick={() => setInput(index.description)}>
                            <CommandItem key={index.place_id} >
                                {index.description}
                            </CommandItem>
                            </div>
                        ))}
                        </CommandGroup>
                        <CommandSeparator />
                    </CommandList>
                </Command>
            </div>

            <div>
                <button onClick={handleSearchClick} disabled={loading}>
                    {loading ? "Searching..." : "Search"}
                </button>
            </div>

            <div>{displayResults()}</div>
        </div>
    );
};

export default Dashboard;
