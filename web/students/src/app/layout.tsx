export const metadata = {
  title: 'SVBK Students Portal',
  description: 'Student-facing portal for the SVBK platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
