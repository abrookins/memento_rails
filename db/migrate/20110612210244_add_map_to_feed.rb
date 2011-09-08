class AddMapToFeed < ActiveRecord::Migration
  def self.up
    change_table :feeds do |t|
      t.references :map
    end
  end

  def self.down
    change_table :feeds do |t|
      t.remove :map_id
    end
  end
end
