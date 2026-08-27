import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit, Mail, Settings, Star, Users } from "lucide-react";

export default function UserProfileWithStats() {
  return (
    <div className="container mx-auto px-4 py-6 md:px-6 2xl:max-w-[1400px]">
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit className="mr-2 size-4" />
            Edit Profile
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="mr-2 size-4" />
            Settings
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <Card className="p-0">
            <CardContent className="p-6">
              <div className="flex flex-col items-center">
                <Avatar className="size-20">
                  <AvatarImage
                    src="https://github.com/shadcn.png"
                    alt="User Avatar"
                  />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
                <h2 className="mt-4 text-lg font-semibold">John Doe</h2>
                <p className="text-muted-foreground text-sm">
                  Product Designer
                </p>
                <Badge className="mt-2" variant="secondary">
                  Pro Member
                </Badge>
                <Button className="mt-4 w-full" size="sm">
                  <Mail className="mr-2 size-4" />
                  Message
                </Button>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Member since</span>
                  <span>Jan 2024</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last active</span>
                  <span>2 hours ago</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Role</span>
                  <span>Admin</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="space-y-6 md:col-span-3">
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-0">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 rounded-lg p-2">
                    <Star className="text-primary size-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">128</p>
                    <p className="text-muted-foreground text-sm">
                      Projects Completed
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="p-0">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 rounded-lg p-2">
                    <Users className="text-primary size-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">8.5k</p>
                    <p className="text-muted-foreground text-sm">
                      Team Members
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="p-0">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 rounded-lg p-2">
                    <Star className="text-primary size-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold">99%</p>
                    <p className="text-muted-foreground text-sm">
                      Satisfaction Rate
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="p-0">
            <CardContent className="p-6">
              <h3 className="mb-4 text-lg font-semibold">Recent Activity</h3>
              <div className="space-y-4">
                {[1, 2, 3].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 border-b pb-4 last:border-0"
                  >
                    <div className="bg-muted rounded-full p-2">
                      <Star className="text-muted-foreground size-4" />
                    </div>
                    <div>
                      <p className="text-sm">
                        Completed project &quot;Dashboard UI&quot;
                      </p>
                      <p className="text-muted-foreground text-xs">
                        2 hours ago
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
