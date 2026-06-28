// src/components/GlobalLocations.tsx
import { useMemo, useState } from "react";
import { MapPin, Search, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

type CityCard = {
  city: string;
  country: string;
  muslimsCountLabel: string; // e.g. "15M+"
  mosquesCount: number;
  featured?: boolean;
};

const DEFAULT_CITIES: CityCard[] = [
  { city: "Istanbul", country: "Turkey", muslimsCountLabel: "15M+", mosquesCount: 3500, featured: true },
  { city: "Dubai", country: "UAE", muslimsCountLabel: "3.1M+", mosquesCount: 1800, featured: true },
  { city: "Jakarta", country: "Indonesia", muslimsCountLabel: "9M+", mosquesCount: 4500, featured: true }
];

const GlobalLocations = () => {
  const { t } = useTranslation("features");

  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return DEFAULT_CITIES;

    return DEFAULT_CITIES.filter((c) => {
      const hay = `${c.city} ${c.country}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  return (
    <section className="py-14">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            {t("mosques.title")}
          </h2>
          <p className="mt-2 text-muted-foreground">
            {t("mosques.subtitle")}
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Card className="shadow-sm">
            <CardContent className="p-4 md:p-5">
              <div className="flex flex-col md:flex-row gap-3 md:items-center">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("mosques.searchPlaceholder")}
                    className="pl-9 rounded-xl"
                  />
                </div>

                <Button
                  type="button"
                  className="rounded-xl"
                  onClick={() => setShowFilters((v) => !v)}
                >
                  <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("mosques.filterButton")}
                </Button>
              </div>

              {showFilters && (
                <div className="mt-4 text-sm text-muted-foreground">
                  {/* Keep your real filters here later. */}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-10">
          <h3 className="text-xl font-semibold text-foreground mb-4">
            {t("mosques.majorCitiesTitle")}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((c) => (
              <Card key={`${c.city}-${c.country}`} className="shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-islamic-green/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-5 w-5 text-islamic-green" aria-hidden="true" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">
                        {c.city}, {c.country}
                      </p>
                      {c.featured && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-islamic-green/10 text-islamic-green">
                          {t("mosques.featured")}
                        </span>
                      )}
                    </div>
                  <p className="text-sm text-muted-foreground">
                    {t("mosques.muslimsLabel", { countLabel: c.muslimsCountLabel, defaultValue: "{{countLabel}} Muslims" })}
                  </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-islamic-green">
                      {c.mosquesCount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("mosques.mosquesLabel")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default GlobalLocations;
