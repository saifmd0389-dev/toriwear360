import React, { useState } from 'react';
import { AIDesignConcept } from '../types/ai';

// Subcomponents
import { AIDashboardSection } from './ai-design-lab/AIDashboardSection';
import { AICreateDesignSection } from './ai-design-lab/AICreateDesignSection';
import { AICharactersSection } from './ai-design-lab/AICharactersSection';
import { AIWorldsSection } from './ai-design-lab/AIWorldsSection';
import { AIStoriesSection } from './ai-design-lab/AIStoriesSection';
import { AICollectionsSection } from './ai-design-lab/AICollectionsSection';
import { AISavedConceptsSection } from './ai-design-lab/AISavedConceptsSection';
import { AIGeneratedArtworkSection } from './ai-design-lab/AIGeneratedArtworkSection';
import { AIDesignLibrarySection } from './ai-design-lab/AIDesignLibrarySection';
import { AISettingsSection } from './ai-design-lab/AISettingsSection';

// Modals
import { AIDesignWorkspaceModal } from './ai-design-lab/AIDesignWorkspaceModal';
import { AIVariationModal } from './ai-design-lab/AIVariationModal';

import {
  Sparkles,
  LayoutDashboard,
  Users,
  Globe,
  BookOpen,
  Layers,
  Bookmark,
  Image,
  Library,
  Sliders,
} from 'lucide-react';

export type AIDesignLabSection =
  | 'Dashboard'
  | 'Create Design'
  | 'Characters'
  | 'Worlds'
  | 'Stories'
  | 'Collections'
  | 'Saved Concepts'
  | 'Generated Artwork'
  | 'Design Library'
  | 'AI Settings';

export const AIDesignLabView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<AIDesignLabSection>('Dashboard');

  // Modals state
  const [selectedConceptForWorkspace, setSelectedConceptForWorkspace] =
    useState<AIDesignConcept | null>(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);

  const [selectedConceptForVariation, setSelectedConceptForVariation] =
    useState<AIDesignConcept | null>(null);
  const [isVariationModalOpen, setIsVariationModalOpen] = useState(false);

  // Cross-section filters
  const [collectionFilterForLibrary, setCollectionFilterForLibrary] = useState<string>('ALL');

  const handleOpenConcept = (concept: AIDesignConcept) => {
    setSelectedConceptForWorkspace(concept);
    setIsWorkspaceOpen(true);
  };

  const handleOpenVariation = (concept: AIDesignConcept) => {
    setSelectedConceptForVariation(concept);
    setIsVariationModalOpen(true);
  };

  const handleUseCharacterInDesign = (_characterName: string, _world: string) => {
    setActiveSection('Create Design');
  };

  const handleUseWorldInDesign = (_worldName: string, _dept: 'MEN' | 'KIDS') => {
    setActiveSection('Create Design');
  };

  const handleFilterByCollection = (collectionName: string) => {
    setCollectionFilterForLibrary(collectionName);
    setActiveSection('Design Library');
  };

  const SECTIONS: { id: AIDesignLabSection; label: string; icon: React.ReactNode }[] = [
    { id: 'Dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'Create Design', label: 'Create Design', icon: <Sparkles className="w-4 h-4 text-red-500" /> },
    { id: 'Characters', label: 'Characters', icon: <Users className="w-4 h-4" /> },
    { id: 'Worlds', label: 'Worlds', icon: <Globe className="w-4 h-4" /> },
    { id: 'Stories', label: 'Stories', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'Collections', label: 'Collections', icon: <Layers className="w-4 h-4" /> },
    { id: 'Saved Concepts', label: 'Saved Concepts', icon: <Bookmark className="w-4 h-4" /> },
    { id: 'Generated Artwork', label: 'Generated Artwork', icon: <Image className="w-4 h-4" /> },
    { id: 'Design Library', label: 'Design Library', icon: <Library className="w-4 h-4" /> },
    { id: 'AI Settings', label: 'AI Settings', icon: <Sliders className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Top Section Nav Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white border border-slate-200 overflow-x-auto no-scrollbar shadow-sm">
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            onClick={() => setActiveSection(sec.id)}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition whitespace-nowrap cursor-pointer ${
              activeSection === sec.id
                ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
            style={activeSection === sec.id ? { color: '#ffffff' } : undefined}
          >
            {sec.icon}
            <span>{sec.label}</span>
          </button>
        ))}
      </div>

      {/* Render Active Section */}
      <div className="min-h-[500px]">
        {activeSection === 'Dashboard' && (
          <AIDashboardSection
            onNavigateSection={(sec) => setActiveSection(sec as AIDesignLabSection)}
            onOpenConcept={handleOpenConcept}
          />
        )}

        {activeSection === 'Create Design' && (
          <AICreateDesignSection onOpenConcept={handleOpenConcept} />
        )}

        {activeSection === 'Characters' && (
          <AICharactersSection onUseCharacterInDesign={handleUseCharacterInDesign} />
        )}

        {activeSection === 'Worlds' && (
          <AIWorldsSection onUseWorldInDesign={handleUseWorldInDesign} />
        )}

        {activeSection === 'Stories' && (
          <AIStoriesSection onOpenConcept={handleOpenConcept} />
        )}

        {activeSection === 'Collections' && (
          <AICollectionsSection onFilterByCollection={handleFilterByCollection} />
        )}

        {activeSection === 'Saved Concepts' && (
          <AISavedConceptsSection onOpenConcept={handleOpenConcept} />
        )}

        {activeSection === 'Generated Artwork' && (
          <AIGeneratedArtworkSection onOpenConcept={handleOpenConcept} />
        )}

        {activeSection === 'Design Library' && (
          <AIDesignLibrarySection
            onOpenConcept={handleOpenConcept}
            onOpenVariationModal={handleOpenVariation}
            initialCollectionFilter={collectionFilterForLibrary}
          />
        )}

        {activeSection === 'AI Settings' && <AISettingsSection />}
      </div>

      {/* Global AI Design Workspace Modal */}
      <AIDesignWorkspaceModal
        concept={selectedConceptForWorkspace}
        isOpen={isWorkspaceOpen}
        onClose={() => {
          setIsWorkspaceOpen(false);
          setSelectedConceptForWorkspace(null);
        }}
        onOpenVariationModal={(concept) => {
          setIsWorkspaceOpen(false);
          handleOpenVariation(concept);
        }}
      />

      {/* Global AI Variation Modal */}
      <AIVariationModal
        concept={selectedConceptForVariation}
        isOpen={isVariationModalOpen}
        onClose={() => {
          setIsVariationModalOpen(false);
          setSelectedConceptForVariation(null);
        }}
        onVariationCreated={(newConcept) => {
          handleOpenConcept(newConcept);
        }}
      />
    </div>
  );
};
