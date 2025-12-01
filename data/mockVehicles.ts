export interface Vehicle {
  id: string;
  title: string;
  year: number;
  mileage: number;
  price: number;
  location: string;
  phone?: string;
  imageUrl: string;
  expirationDate: string;
  fuelType: string;
  transmission: string;
  power: string;
  bodyType: string;
  color: string;
  doors: number;
  seats: number;
  previousOwners: number;
  description: string;
  createdAt: string;
}

export const mockVehicles: Vehicle[] = [
  {
    id: "auto-12345678",
    title: "BMW 320d xDrive Touring M Sport",
    year: 2021,
    mileage: 45000,
    price: 38900,
    location: "Wien",
    phone: "+43 664 1234567",
    imageUrl: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=400&h=400&fit=crop",
    expirationDate: "2025-01-15",
    fuelType: "Diesel",
    transmission: "Automatik",
    power: "190 PS",
    bodyType: "Kombi",
    color: "Schwarz Metallic",
    doors: 5,
    seats: 5,
    previousOwners: 1,
    description: "Gepflegter BMW mit voller Ausstattung, Serviceheft, Nichtraucher.",
    createdAt: "2024-12-01T10:30:00Z",
  },
  {
    id: "auto-23456789",
    title: "Audi A4 Avant 2.0 TDI quattro",
    year: 2020,
    mileage: 62000,
    price: 32500,
    location: "Graz",
    phone: "+43 699 2345678",
    imageUrl: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=400&h=400&fit=crop",
    expirationDate: "2025-01-20",
    fuelType: "Diesel",
    transmission: "Automatik",
    power: "150 PS",
    bodyType: "Kombi",
    color: "Grau Metallic",
    doors: 5,
    seats: 5,
    previousOwners: 2,
    description: "S-Line Paket, LED Scheinwerfer, Navigationssystem.",
    createdAt: "2024-11-30T14:15:00Z",
  },
  {
    id: "auto-34567890",
    title: "Mercedes-Benz C 220 d AMG Line",
    year: 2022,
    mileage: 28000,
    price: 45900,
    location: "Salzburg",
    imageUrl: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=400&h=400&fit=crop",
    expirationDate: "2025-02-01",
    fuelType: "Diesel",
    transmission: "Automatik",
    power: "200 PS",
    bodyType: "Limousine",
    color: "Weiß",
    doors: 4,
    seats: 5,
    previousOwners: 1,
    description: "AMG Line, Panoramadach, 360° Kamera, Top Zustand.",
    createdAt: "2024-11-29T09:00:00Z",
  },
  {
    id: "auto-45678901",
    title: "Volkswagen Golf 8 GTI",
    year: 2023,
    mileage: 15000,
    price: 41000,
    location: "Linz",
    phone: "+43 660 4567890",
    imageUrl: "https://images.unsplash.com/photo-1471444928139-48c5bf5173f8?w=400&h=400&fit=crop",
    expirationDate: "2025-01-25",
    fuelType: "Benzin",
    transmission: "DSG",
    power: "245 PS",
    bodyType: "Hatchback",
    color: "Rot",
    doors: 5,
    seats: 5,
    previousOwners: 1,
    description: "Wie neu, Werksgarantie, alle Extras.",
    createdAt: "2024-11-28T16:45:00Z",
  },
  {
    id: "auto-56789012",
    title: "Skoda Octavia RS Combi",
    year: 2021,
    mileage: 55000,
    price: 29900,
    location: "Innsbruck",
    phone: "+43 676 5678901",
    imageUrl: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=400&h=400&fit=crop",
    expirationDate: "2025-01-18",
    fuelType: "Benzin",
    transmission: "DSG",
    power: "245 PS",
    bodyType: "Kombi",
    color: "Blau Metallic",
    doors: 5,
    seats: 5,
    previousOwners: 1,
    description: "RS Paket, Canton Soundsystem, Matrix LED.",
    createdAt: "2024-11-27T11:20:00Z",
  },
  {
    id: "auto-67890123",
    title: "Porsche 911 Carrera S",
    year: 2019,
    mileage: 32000,
    price: 129000,
    location: "Wien",
    imageUrl: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&h=400&fit=crop",
    expirationDate: "2025-02-10",
    fuelType: "Benzin",
    transmission: "PDK",
    power: "450 PS",
    bodyType: "Coupe",
    color: "Silber Metallic",
    doors: 2,
    seats: 4,
    previousOwners: 2,
    description: "Sport Chrono Paket, Keramik Bremsen, Vollausstattung.",
    createdAt: "2024-11-26T08:30:00Z",
  },
  {
    id: "auto-78901234",
    title: "Toyota RAV4 Hybrid AWD",
    year: 2022,
    mileage: 25000,
    price: 39500,
    location: "Klagenfurt",
    phone: "+43 664 7890123",
    imageUrl: "https://images.unsplash.com/photo-1581540222194-0def2dda95b8?w=400&h=400&fit=crop",
    expirationDate: "2025-01-30",
    fuelType: "Hybrid",
    transmission: "CVT",
    power: "222 PS",
    bodyType: "SUV",
    color: "Grün Metallic",
    doors: 5,
    seats: 5,
    previousOwners: 1,
    description: "Style Selection, JBL Sound, Adaptiver Tempomat.",
    createdAt: "2024-11-25T13:00:00Z",
  },
  {
    id: "auto-89012345",
    title: "Tesla Model 3 Long Range",
    year: 2023,
    mileage: 18000,
    price: 42900,
    location: "Wien",
    imageUrl: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=400&h=400&fit=crop",
    expirationDate: "2025-02-05",
    fuelType: "Elektro",
    transmission: "Automatik",
    power: "491 PS",
    bodyType: "Limousine",
    color: "Weiß",
    doors: 4,
    seats: 5,
    previousOwners: 1,
    description: "Autopilot, Premium Interieur, Supercharger kostenlos.",
    createdAt: "2024-11-24T15:30:00Z",
  },
];

export const getSortedVehicles = (): Vehicle[] => {
  return [...mockVehicles].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const getVehicleById = (id: string): Vehicle | undefined => {
  return mockVehicles.find((v) => v.id === id);
};

export const getSimilarVehicles = (currentId: string): Vehicle[] => {
  return mockVehicles.filter((v) => v.id !== currentId).slice(0, 4);
};
