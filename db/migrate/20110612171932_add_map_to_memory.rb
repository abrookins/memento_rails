class AddMapToMemory < ActiveRecord::Migration
  def self.up
    change_table :memories do |t|
      t.references :map
    end
  end

  def self.down
    change_table :memories do |t|
      t.remove :map_id
    end
  end
end
