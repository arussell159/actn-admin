import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { UploadCloud } from 'lucide-react';
import { useState } from 'react';

export default function ComplexForm() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 md:px-6 2xl:max-w-[1400px]">
      <Card>
        <CardHeader>
          <CardTitle>Create Product Listing</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-8">
            {/* Basic Information */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Basic Information</h3>
                <p className="text-muted-foreground text-sm">
                  Add your product details below.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input id="name" placeholder="Enter product name" />
                </div>

                <div className="space-y-2">
                  <Label>Product Category</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electronics">Electronics</SelectItem>
                      <SelectItem value="clothing">Clothing</SelectItem>
                      <SelectItem value="books">Books</SelectItem>
                      <SelectItem value="home">Home & Garden</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Availability</Label>
                  <RadioGroup
                    defaultValue="instock"
                    className="flex flex-col gap-4 sm:flex-row"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="instock" id="instock" />
                      <Label htmlFor="instock">In Stock</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="preorder" id="preorder" />
                      <Label htmlFor="preorder">Pre-order</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="backorder" id="backorder" />
                      <Label htmlFor="backorder">Backorder</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>

            <Separator />

            {/* Media Upload */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Product Media</h3>
                <p className="text-muted-foreground text-sm">
                  Add product images and media.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Product Images</Label>
                  <div className="flex w-full items-center justify-center">
                    <label
                      htmlFor="image-upload"
                      className="hover:bg-muted/50 flex h-64 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed"
                    >
                      {imagePreview ? (
                        <img
                          width={1280}
                          height={720}
                          src={imagePreview}
                          alt="Preview"
                          className="h-full object-contain"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <UploadCloud className="text-muted-foreground mb-2 h-12 w-12" />
                          <p className="text-muted-foreground mb-2 text-sm">
                            <span className="font-semibold">
                              Click to upload
                            </span>{' '}
                            or drag and drop
                          </p>
                          <p className="text-muted-foreground text-xs">
                            PNG, JPG or GIF (MAX. 800x400px)
                          </p>
                        </div>
                      )}
                      <Input
                        id="image-upload"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Additional Options */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Additional Options</h3>
                <p className="text-muted-foreground text-sm">
                  Configure additional product options.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Features</Label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="featured" />
                      <Label htmlFor="featured">Featured Product</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="sale" />
                      <Label htmlFor="sale">On Sale</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="new" />
                      <Label htmlFor="new">New Arrival</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="exclusive" />
                      <Label htmlFor="exclusive">Exclusive</Label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button variant="outline">Cancel</Button>
              <Button>Create Product</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
