import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ArrowRight, CheckCircle, XCircle, Code, AlertTriangle } from 'lucide-react';

export function TransformPreview({ open, onClose, data }) {
  if (!data) return null;

  const results = data.results || data.transformedRecords || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-primary" />
            Transformation Preview
          </DialogTitle>
          <DialogDescription>
            Preview how source data will be transformed to target format
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="table" className="mt-4">
          <TabsList>
            <TabsTrigger value="table">Table View</TabsTrigger>
            <TabsTrigger value="json">JSON View</TabsTrigger>
          </TabsList>
          
          <TabsContent value="table">
            <ScrollArea className="h-[400px]">
              {results.length > 0 ? (
                <div className="space-y-4">
                  {results.map((record, idx) => (
                    <div key={idx} className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {record.sourceModel} → {record.targetEntity}
                        </span>
                        {record.error ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Error
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Mapped
                          </Badge>
                        )}
                      </div>
                      
                      {record.error ? (
                        <div className="p-4 text-red-600 text-sm">{record.error}</div>
                      ) : (
                        <div className="grid grid-cols-2 divide-x">
                          {/* Source Data */}
                          <div className="p-3">
                            <p className="text-xs font-medium text-muted-foreground mb-2">Source Data</p>
                            <div className="space-y-1">
                              {Object.entries(record.source || {}).map(([key, value]) => (
                                <div key={key} className="flex justify-between text-xs">
                                  <span className="font-mono text-gray-600">{key}</span>
                                  <span className="text-gray-800 max-w-[150px] truncate">
                                    {String(value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Transformed Data */}
                          <div className="p-3 bg-green-50/50">
                            <p className="text-xs font-medium text-green-700 mb-2">Transformed Data</p>
                            <div className="space-y-1">
                              {Object.entries(record.transformed || {}).map(([key, value]) => (
                                <div key={key} className="flex justify-between text-xs">
                                  <span className="font-mono text-green-700">{key}</span>
                                  <span className="text-green-900 max-w-[150px] truncate">
                                    {value === null ? (
                                      <span className="italic text-gray-400">null</span>
                                    ) : typeof value === 'boolean' ? (
                                      value ? (
                                        <CheckCircle className="h-3 w-3 text-green-500 inline" />
                                      ) : (
                                        <XCircle className="h-3 w-3 text-red-500 inline" />
                                      )
                                    ) : (
                                      String(value)
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No preview data available. Configure field mappings first.
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="json">
            <ScrollArea className="h-[400px]">
              <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-auto">
                {JSON.stringify(data, null, 2)}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        <DialogFooter className="mt-4">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              {data.previewCount || results.length} records previewed
            </div>
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
