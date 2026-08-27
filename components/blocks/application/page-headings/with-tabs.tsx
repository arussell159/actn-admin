import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, SlidersHorizontal } from 'lucide-react';

export default function PageHeadingWithTabs() {
  return (
    <div className="border-b">
      <div className="container mx-auto px-4 py-16 md:px-6 2xl:max-w-[1400px]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
              Products
            </h1>
            <p className="text-muted-foreground mt-2">
              Browse and manage your products inventory
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                type="search"
                placeholder="Search products..."
                className="pl-8"
              />
            </div>
            <Button>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>

        <div className="mt-8 flex gap-4 border-b">
          <a
            href="#"
            className="border-primary border-b-2 px-4 py-2.5 text-sm font-medium"
          >
            All Products
          </a>
          <a
            href="#"
            className="text-muted-foreground hover:border-muted border-b-2 border-transparent px-4 py-2.5 text-sm font-medium"
          >
            Active
          </a>
          <a
            href="#"
            className="text-muted-foreground hover:border-muted border-b-2 border-transparent px-4 py-2.5 text-sm font-medium"
          >
            Draft
          </a>
          <a
            href="#"
            className="text-muted-foreground hover:border-muted border-b-2 border-transparent px-4 py-2.5 text-sm font-medium"
          >
            Archived
          </a>
        </div>
      </div>
    </div>
  );
}
