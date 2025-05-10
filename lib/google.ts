"use server";
import { Client } from "@googlemaps/google-maps-services-js";

const client = new Client();

const autocomplete = async (input: string) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error("Google API key is not defined");
    }
    
    try {
        const response = await client.placeAutocomplete({
        params: {
            input,
            key: apiKey,
        },
        });
    
        return response.data.predictions.map((prediction) => prediction.description);
    } catch (error) {
        console.error("Error fetching autocomplete suggestions:", error);
        throw error;
    }
    }

export default autocomplete;