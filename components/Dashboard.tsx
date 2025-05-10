'use client';
import { useEffect, useState } from "react";
import { Command, CommandGroup, CommandInput, CommandList } from "./ui/command";
import { CommandEmpty, CommandItem, CommandSeparator } from "cmdk";
import { motion, AnimatePresence } from "framer-motion";
import autocomplete from "@/lib/google";
import { PlaceAutocompleteResult } from "@googlemaps/google-maps-services-js";
import { Loader2, Star, FileDown, AlertCircle, X, Info } from "lucide-react";

export const Dashboard = () => {
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [predictions, setPrediction] = useState<PlaceAutocompleteResult[]>([]);
  const [input, setInput] = useState<string>("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<boolean>(false);

  // Get the API base URL from environment variables, with fallback
  const getApiBaseUrl = () => {
    // For client-side code, use the NEXT_PUBLIC_ prefix for environment variables
    return process.env.NEXT_PUBLIC_API_BASE_URL || '';
  };

  // Function to handle search
  const handleSearch = async (searchTerm: string) => {
    setLoading(true);
    setError(null);
    setSelected(true);
    try {
      const apiUrl = `${getApiBaseUrl()}/api/scrape-reviews?searchTerm=${encodeURIComponent(searchTerm)}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to fetch reviews. Please check your connection and try again.");
    } finally {
      setLoading(false);
      setSelected(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (selectedValue: string) => {
    setInput(selectedValue);
    handleSearch(selectedValue);
  };

  // Generate and download PDF
  const handleDownloadPDF = async () => {
    if (searchResults.length === 0) {
      setError("No reviews available to download.");
      return;
    }
    
    setDownloading(true);
    setError(null);
    
    try {
      // Dynamically import jsPDF only when needed
      const { jsPDF } = await import("jspdf");
      
      // Create a new PDF document
      const doc = new jsPDF();
      
      // Add title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(`Reviews for ${input}`, doc.internal.pageSize.getWidth() / 2, 20, { align: "center" });
      
      let y = 40; // Starting y position after title
      
      // Add each review to the PDF
      for (let i = 0; i < searchResults.length; i++) {
        const review = searchResults[i];
        
        // Check if we need a new page
        if (y > 250) {
          doc.addPage();
          y = 20;
        }
        
        // Add reviewer name
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(review.fullName || "Anonymous", 20, y);
        y += 8;
        
        // Add star rating
        const starRating = typeof review.stars === 'string' ? 
          review.stars : 
          Array.isArray(review.stars) ? 
            review.stars[0] : review.stars;
            
        doc.setTextColor(255, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Rating: ${starRating} stars`, 20, y);
        doc.setTextColor(0, 0, 0);
        y += 8;
        
        // Add review text
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        
        // Handle the review text
        const reviewText = review.reviewText || "No review text provided";
        // Split text into lines that fit within the page width
        const textLines = doc.splitTextToSize(reviewText, 170);
        
        // Check if we need to add a new page for long review text
        if (y + (textLines.length * 7) > 270) {
          doc.addPage();
          y = 20;
        }
        
        doc.text(textLines, 20, y);
        y += (textLines.length * 7);
        
        // Add separator line (except after the last review)
        if (i < searchResults.length - 1) {
          y += 5;
          doc.setDrawColor(200, 200, 200);
          doc.line(20, y, 190, y);
          y += 10;
        }
      }
      
      // Save the PDF file with a name based on the business name
      const safeFileName = input.replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`${safeFileName}_reviews.pdf`);
      
    } catch (error) {
      console.error("Error generating PDF:", error);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  // Clear error message
  const dismissError = () => {
    setError(null);
  };

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        if (typeof autocomplete !== 'function') {
          console.error('Autocomplete function not available');
          return;
        }
        
        const prediction = await autocomplete(input);
        if (Array.isArray(prediction)) {
          const formattedPrediction = prediction.map((item) => ({ description: item } as PlaceAutocompleteResult));
          setPrediction(formattedPrediction || []);
        } else {
          setPrediction([]);
        }
      } catch (error) {
        console.error("Error fetching predictions:", error);
        setPrediction([]);
      }
    };

    if (input.length > 2) {
      fetchPredictions();
    } else {
      setPrediction([]);
    }
  }, [input]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6 md:p-12">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto"
      >
        <h1 className="text-3xl md:text-4xl font-bold text-slate-800 mb-8 text-center">
          Business Review Explorer
        </h1>

        {/* Error Notification */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-start justify-between"
            >
              <div className="flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
              <button 
                onClick={dismissError}
                className="text-red-500 hover:text-red-700 focus:outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Message about supported link types */}
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-4 flex items-start">
          <Info className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
          <p className="text-sm">
            <span className="font-medium">Note:</span> Currently supports business names and Google Maps links. Regular business website links are not supported.
          </p>
        </div>
          
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="mb-4">
            <Command className="rounded-lg border border-slate-200 shadow-sm">
              <div className="ml-10 flex items-center px-3 border-b max-w-xl">
               
                <CommandInput 
                  placeholder="Enter business name or location" 
                  value={input}
                  onValueChange={setInput}
                  className="outline-none py-3 px-1 flex flex-row items-center w-7xl"
                />
              </div>
              {input && !selected &&
              <CommandList className="ml-15 max-h-[200px] overflow-y-auto">
                <CommandEmpty className="py-3 text-center text-sm text-slate-500">
                  No results found.
                </CommandEmpty>
                <AnimatePresence>
                  {predictions.length > 0 && (
                    <CommandGroup heading="Suggestions">
                      {predictions.map((prediction, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2, delay: idx * 0.05 }}
                        >
                          <CommandItem 
                            className="cursor-pointer hover:bg-slate-100 py-2 px-3 rounded-md"
                            onSelect={() => handleSuggestionSelect(prediction.description)}
                            onClick={() => {
                              setSelected(true);
                            }}
                          >
                            {prediction.description}
                          </CommandItem>
                        </motion.div>
                      ))}
                    </CommandGroup>
                  )}
                </AnimatePresence>
                <CommandSeparator />
              </CommandList>
            }
            </Command>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full py-3 px-4 rounded-lg font-medium text-white 
              ${loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} 
              transition-colors flex items-center justify-center`}
            onClick={() => handleSearch(input)}
            disabled={loading || !input.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Searching...
              </>
            ) : (
              <>Search</>
            )}
          </motion.button>
        </div>

        {searchResults.length > 0 && (
          <div className="mb-6 flex justify-end">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`flex items-center px-4 py-2 rounded-lg font-medium 
                ${downloading ? 'bg-green-100 text-green-700' : 'bg-green-500 hover:bg-green-600 text-white'} 
                shadow-sm transition-all duration-200`}
              onClick={handleDownloadPDF}
              disabled={downloading || searchResults.length === 0}
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 mr-2" />
                  Download as PDF
                </>
              )}
            </motion.button>
          </div>
        )}

        <div className="space-y-6">
          <AnimatePresence>
            {loading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-center py-12"
              >
                <div className="text-center">
                  <Loader2 className="w-12 h-12 animate-spin mx-auto text-indigo-600 mb-4" />
                  <p className="text-slate-600">Fetching reviews...</p>
                </div>
              </motion.div>
            ) : searchResults.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white rounded-xl p-8 text-center text-slate-500"
              >
                Search for a business to see reviews
              </motion.div>
            ) : (
              searchResults.map((result, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="bg-white rounded-xl shadow-md overflow-hidden"
                >
                  <div className="p-6">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">{result.fullName}</h2>
                    <div className="flex items-center mb-3">
                      <div className="flex mr-2">
                        {[...Array(5)].map((_, i) => {
                          // Handle different formats of stars data
                          const starValue = typeof result.stars === 'string' ? 
                            parseFloat(result.stars) : 
                            Array.isArray(result.stars) ? 
                              parseFloat(result.stars[0]) : result.stars;
                          
                          return (
                            <Star
                              key={i}
                              className={`w-5 h-5 ${
                                i < Math.floor(starValue || 0) 
                                  ? 'text-yellow-400 fill-current drop-shadow-sm' 
                                  : 'text-gray-300 stroke-current fill-none'
                              }`}
                            />
                          );
                        })}
                      </div>
                      <div className="bg-amber-100 px-2 py-0.5 rounded-md">
                        <span className="text-red-600 font-bold">
                          {typeof result.stars === 'string' ? 
                            result.stars : 
                            Array.isArray(result.stars) ? 
                              result.stars[0] : result.stars}
                        </span>
                        <span className="text-amber-800 font-medium"> stars</span>
                      </div>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{result.reviewText}</p>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;