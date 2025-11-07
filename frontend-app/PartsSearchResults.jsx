import React from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, DollarSign, Store, Search } from 'lucide-react';

const PartsSearchResults = ({ responseData }) => {
  const { output_text, parsed_data } = responseData;

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      {/* Search Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Search Results</h2>
            <Badge variant="secondary">
              {parsed_data?.web_searches?.length || 0} searches performed
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">{output_text}</p>
        </CardContent>
      </Card>

      {/* Retailers Summary */}
      {parsed_data?.retailers?.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Retailers Found</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {parsed_data.retailers.map((retailer, index) => (
                <Badge key={index} variant="outline" className="px-3 py-1">
                  {retailer.name} ({retailer.citations} results)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parts Pricing Grid */}
      {parsed_data?.parts_pricing?.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {parsed_data.parts_pricing.map((part, index) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-sm line-clamp-2">
                    {part.part_name}
                  </h4>
                  <Badge 
                    variant="secondary" 
                    className={`ml-2 ${
                      part.category === 'brake' ? 'bg-red-100 text-red-800' :
                      part.category === 'engine' ? 'bg-blue-100 text-blue-800' :
                      part.category === 'electrical' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {part.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="font-bold text-lg">
                      {part.price_info?.range ? (
                        `$${part.price_info.min} - $${part.price_info.max}`
                      ) : (
                        `$${part.price_info?.min || 'N/A'}`
                      )}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Brand: <span className="font-medium">{part.brand}</span>
                  </div>
                  {part.price_info?.range && (
                    <div className="text-xs text-gray-500">
                      Price range available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Citations/Sources */}
      {parsed_data?.citations?.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Sources & Citations</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {parsed_data.citations.map((citation, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <a 
                        href={citation.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        {citation.title}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <div className="text-sm text-gray-600 mt-1">
                        {citation.retailer && (
                          <Badge variant="outline" className="mr-2">
                            {citation.retailer}
                          </Badge>
                        )}
                        {citation.text_snippet}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Price Comparison Chart */}
      {parsed_data?.parts_pricing?.length > 1 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Price Comparison</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {parsed_data.parts_pricing
                .filter(part => part.price_info?.min)
                .sort((a, b) => a.price_info.min - b.price_info.min)
                .map((part, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium">{part.brand}</div>
                      <div className="text-sm text-gray-600">{part.part_name}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">
                        ${part.price_info.min}
                        {part.price_info.range && ` - $${part.price_info.max}`}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PartsSearchResults;