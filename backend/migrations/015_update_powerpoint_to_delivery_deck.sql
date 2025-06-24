-- Migration: Update PowerPoint deliverable to Delivery Deck
-- This migration updates the PowerPoint deliverable name to "Delivery Deck"

UPDATE deliverables 
SET name = 'Delivery Deck'
WHERE name = 'PowerPoint';