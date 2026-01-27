import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { ArrowRight, CheckCircle, XCircle, Code } from 'lucide-react';

export function TransformPreview({ open, onClose, data }) {
  if (!data) return null;

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
              {data.transformedRecords?.length > 0 ? (
                <div className="space-y-4">
                  {data.transformedRecords.map((record, idx) => (
                    <div key={idx} className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                        <span className="font-medium">Record {idx + 1}</span>
                        <Badge variant="outline">{record._entity || 'unknown'}</Badge>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-1/3">Target Field</TableHead>
                            <TableHead className="w-1/3">Value</TableHead>
                            <TableHead>Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(record)
                            .filter(([key]) => !key.startsWith('_'))
                            .map(([key, value]) => (
                              <TableRow key={key}>
                                <TableCell className="font-mono text-sm">{key}</TableCell>
                                <TableCell className="text-sm">
                                  {value === null ? (
                                    <span className="text-gray-400 italic">null</span>
                                  ) : typeof value === 'boolean' ? (
                                    value ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-red-500" />
                                    )
                                  ) : (
                                    String(value).substring(0, 50)
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {record._sourceFields?.[key] || '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No preview data available
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
            {data.summary && (
              <div className="text-sm text-muted-foreground">
                {data.summary.total} records • {data.summary.success} success • {data.summary.errors} errors
              </div>
            )}
            <Button onClick={onClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
