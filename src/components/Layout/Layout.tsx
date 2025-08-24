import React from 'react';
import Header from './Header';
import Footer from './Footer';
import AnalyticsWrapper from './AnalyticsWrapper';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <AnalyticsWrapper>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow">{children}</main>
        <Footer />
      </div>
    </AnalyticsWrapper>
  );
};

export default Layout;