import "./globals.css";

export const metadata = {
  title: "Jo Parade",
  description: "Click the Jo invaders with a cooldown between attacks.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
