class RenameMemoriesGeographicEvent < ActiveRecord::Migration
  def change
    rename_table :memories, :geographic_events
  end 
end
